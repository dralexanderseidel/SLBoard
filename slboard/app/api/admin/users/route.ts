import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../lib/adminAuth';
import { getUserAccessContext } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';

export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const access = await getUserAccessContext(user.email, supabase);
    const adminSchool = access.schoolNumber ?? null;

    let usersQuery = supabase
      .from('app_users')
      .select('id, username, full_name, email, org_unit, school_number, created_at')
      .order('username');
    if (adminSchool) usersQuery = usersQuery.eq('school_number', adminSchool);
    const { data: users, error } = await usersQuery;

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    // Rollen pro Nutzer laden
    const { data: allRoles } = await supabase
      .from('user_roles')
      .select('user_id, role_code');
    const rolesByUser = (allRoles ?? []).reduce<Record<string, string[]>>((acc, r) => {
      if (!acc[r.user_id]) acc[r.user_id] = [];
      acc[r.user_id].push(r.role_code);
      return acc;
    }, {});

    const usersWithRoles = (users ?? []).map((u) => ({
      ...u,
      roles: rolesByUser[u.id] ?? [],
    }));

    return NextResponse.json({ users: usersWithRoles });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const access = await getUserAccessContext(user.email, supabase);
    const adminSchool = access.schoolNumber ?? null;

    const body = await req.json();
    const username = (body.username as string)?.trim();
    const fullName = (body.full_name as string)?.trim();
    const email = (body.email as string)?.trim();
    const orgUnit = (body.org_unit as string)?.trim();

    if (!username || !fullName || !email || !orgUnit) {
      return apiError(400, 'VALIDATION_ERROR', 'username, full_name, email und org_unit sind Pflichtfelder.');
    }

    const requestedSchool = (body.school_number as string | undefined)?.trim() ?? '';
    const schoolNumber = adminSchool || requestedSchool;
    if (!schoolNumber) {
      return apiError(400, 'VALIDATION_ERROR', 'school_number ist erforderlich.');
    }
    if (!/^\d{6}$/.test(schoolNumber)) {
      return apiError(400, 'VALIDATION_ERROR', 'school_number muss 6-stellig sein.');
    }

    const { data: newUser, error } = await supabase
      .from('app_users')
      .insert({ username, full_name: fullName, email, org_unit: orgUnit, school_number: schoolNumber })
      .select('id, username, full_name, email, org_unit, school_number, created_at')
      .single();

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    return NextResponse.json({ user: { ...newUser, roles: [] } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
