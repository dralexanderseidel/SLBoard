import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../lib/adminAuth';
import { resolveUserAccess } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';

const DELETE_REQUEST_STATUSES = ['pending', 'acknowledged', 'completed', 'rejected'] as const;

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

    const access = await resolveUserAccess(user.email, supabase);
    const adminSchool = access.schoolNumber ?? null;

    let listQuery = supabase
      .from('account_delete_requests')
      .select(
        'id, school_number, app_user_id, email, requested_at, status, admin_note, resolved_at, resolved_by_app_user_id'
      )
      .order('requested_at', { ascending: false });
    if (adminSchool) {
      listQuery = listQuery.eq('school_number', adminSchool);
    }

    let countQuery = supabase
      .from('account_delete_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (adminSchool) {
      countQuery = countQuery.eq('school_number', adminSchool);
    }

    const [{ data: rows, error: listErr }, { count, error: countErr }] = await Promise.all([
      listQuery,
      countQuery,
    ]);

    if (listErr) {
      return apiError(500, 'INTERNAL_ERROR', listErr.message);
    }
    if (countErr) {
      return apiError(500, 'INTERNAL_ERROR', countErr.message);
    }

    const requests = rows ?? [];
    const appUserIds = [...new Set(requests.map((r) => r.app_user_id as string).filter(Boolean))];
    let namesByUserId: Record<string, string> = {};
    if (appUserIds.length > 0) {
      const { data: appRows } = await supabase
        .from('app_users')
        .select('id, full_name, username')
        .in('id', appUserIds);
      namesByUserId = (appRows ?? []).reduce<Record<string, string>>((acc, row) => {
        const id = row.id as string;
        const fn = (row as { full_name?: string }).full_name?.trim();
        const un = (row as { username?: string }).username?.trim();
        acc[id] = fn || un || id;
        return acc;
      }, {});
    }

    const enriched = requests.map((r) => ({
      ...r,
      app_user_label: namesByUserId[r.app_user_id as string] ?? (r.app_user_id as string),
    }));

    return NextResponse.json({
      requests: enriched,
      pendingCount: count ?? 0,
      statuses: DELETE_REQUEST_STATUSES,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
