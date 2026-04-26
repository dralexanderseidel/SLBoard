import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../../lib/adminAuth';
import { canAccessSchool, resolveUserAccess } from '../../../../../lib/documentAccess';
import { apiError } from '../../../../../lib/apiError';

const STATUSES = new Set(['pending', 'acknowledged', 'completed', 'rejected']);

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

    const access = await resolveUserAccess(user.email, supabase);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      status?: string;
      admin_note?: string | null;
    };

    const { data: row, error: fetchErr } = await supabase
      .from('account_delete_requests')
      .select('id, school_number, status, admin_note')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !row) {
      return apiError(404, 'NOT_FOUND', 'Löschanfrage nicht gefunden.');
    }

    const school = (row as { school_number?: string | null }).school_number ?? null;
    if (!canAccessSchool(access, school)) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für diese Anfrage.');
    }

    let resolverQ = supabase
      .from('app_users')
      .select('id')
      .eq('email', user.email.trim().toLowerCase());
    const admSchool = access.schoolNumber?.trim();
    if (admSchool && /^\d{6}$/.test(admSchool)) {
      resolverQ = resolverQ.eq('school_number', admSchool);
    }
    const { data: resolverRows } = await resolverQ.limit(1);
    const resolverId = resolverRows?.[0] ? (resolverRows[0] as { id: string }).id : null;

    const patch: Record<string, unknown> = {};
    if (typeof body.status === 'string') {
      const s = body.status.trim();
      if (!STATUSES.has(s)) {
        return apiError(400, 'VALIDATION_ERROR', 'Ungültiger Status.');
      }
      patch.status = s;
      if (s === 'pending') {
        patch.resolved_at = null;
        patch.resolved_by_app_user_id = null;
      } else if (resolverId) {
        patch.resolved_at = new Date().toISOString();
        patch.resolved_by_app_user_id = resolverId;
      }
    }
    if (body.admin_note !== undefined) {
      patch.admin_note = body.admin_note === null || body.admin_note === '' ? null : String(body.admin_note);
    }

    if (Object.keys(patch).length === 0) {
      return apiError(400, 'VALIDATION_ERROR', 'Keine Felder zum Aktualisieren.');
    }

    const { data: updated, error: updErr } = await supabase
      .from('account_delete_requests')
      .update(patch)
      .eq('id', id)
      .select(
        'id, school_number, app_user_id, email, requested_at, status, admin_note, resolved_at, resolved_by_app_user_id'
      )
      .single();

    if (updErr) {
      return apiError(500, 'INTERNAL_ERROR', updErr.message);
    }

    return NextResponse.json({ request: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
