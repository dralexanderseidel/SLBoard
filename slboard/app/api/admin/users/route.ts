import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../lib/adminAuth';
import { getUserAccessContext } from '../../../../lib/documentAccess';

export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    }

    if (!(await isAdmin(user.email, supabase))) {
      return NextResponse.json({ error: 'Keine Admin-Berechtigung.' }, { status: 403 });
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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    }

    if (!(await isAdmin(user.email, supabase))) {
      return NextResponse.json({ error: 'Keine Admin-Berechtigung.' }, { status: 403 });
    }

    const access = await getUserAccessContext(user.email, supabase);
    const adminSchool = access.schoolNumber ?? null;

    const body = await req.json();
    const username = (body.username as string)?.trim();
    const fullName = (body.full_name as string)?.trim();
    const email = (body.email as string)?.trim();
    const orgUnit = (body.org_unit as string)?.trim();

    if (!username || !fullName || !email || !orgUnit) {
      return NextResponse.json(
        { error: 'username, full_name, email und org_unit sind Pflichtfelder.' },
        { status: 400 }
      );
    }

    const requestedSchool = (body.school_number as string | undefined)?.trim() ?? '';
    const schoolNumber = adminSchool || requestedSchool;
    if (!schoolNumber) {
      return NextResponse.json({ error: 'school_number ist erforderlich.' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(schoolNumber)) {
      return NextResponse.json({ error: 'school_number muss 6-stellig sein.' }, { status: 400 });
    }

    const { data: newUser, error } = await supabase
      .from('app_users')
      .insert({ username, full_name: fullName, email, org_unit: orgUnit, school_number: schoolNumber })
      .select('id, username, full_name, email, org_unit, school_number, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: { ...newUser, roles: [] } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
