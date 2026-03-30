import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../../lib/adminAuth';
import { canAccessSchool, getUserAccessContext } from '../../../../../lib/documentAccess';
import { apiError } from '../../../../../lib/apiError';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, string> = {};
    if (typeof body.username === 'string' && body.username.trim()) updates.username = body.username.trim();
    if (typeof body.full_name === 'string' && body.full_name.trim()) updates.full_name = body.full_name.trim();
    if (typeof body.email === 'string' && body.email.trim()) updates.email = body.email.trim();
    if (typeof body.org_unit === 'string' && body.org_unit.trim()) updates.org_unit = body.org_unit.trim();

    if (Object.keys(updates).length === 0) {
      return apiError(400, 'VALIDATION_ERROR', 'Keine Felder zum Aktualisieren.');
    }

    const { data: target } = await supabase
      .from('app_users')
      .select('id, school_number')
      .eq('id', id)
      .single();
    const targetSchool = (target as { school_number?: string | null } | null)?.school_number ?? null;
    if (!canAccessSchool(access, targetSchool)) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für diesen Nutzer.');
    }

    let updateQuery = supabase
      .from('app_users')
      .update(updates)
      .eq('id', id)
      .select('id, username, full_name, email, org_unit, school_number, created_at');
    if (targetSchool) updateQuery = updateQuery.eq('school_number', targetSchool);
    const { data, error } = await updateQuery.single();

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
