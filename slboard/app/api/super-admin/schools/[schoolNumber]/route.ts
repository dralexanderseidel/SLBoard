import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { isSuperAdmin } from '../../../../../lib/superAdminAuth';
import { apiError } from '../../../../../lib/apiError';

function parseQuota(n: unknown): number | null | undefined {
  if (n === undefined) return undefined;
  if (n === null || n === '') return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return undefined;
  return Math.floor(v);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ schoolNumber: string }> }
) {
  try {
    const client = await createServerSupabaseClient();
    const {
      data: { user },
    } = (await client?.auth.getUser()) ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    if (!(await isSuperAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Super-Admin-Berechtigung.');
    }

    const { schoolNumber: rawSn } = await params;
    const schoolNumber = (rawSn ?? '').trim();
    if (!/^\d{6}$/.test(schoolNumber)) {
      return apiError(400, 'VALIDATION_ERROR', 'Ungültige Schulnummer.');
    }

    const body = (await req.json()) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};

    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) return apiError(400, 'VALIDATION_ERROR', 'Name darf nicht leer sein.');
      patch.name = name;
    }
    if (typeof body.active === 'boolean') {
      patch.active = body.active;
    }

    const qUsers = parseQuota(body.quota_max_users);
    const qDocs = parseQuota(body.quota_max_documents);
    const qAi = parseQuota(body.quota_max_ai_queries_per_month);

    if (qUsers === undefined && body.quota_max_users !== undefined && body.quota_max_users !== null) {
      return apiError(400, 'VALIDATION_ERROR', 'quota_max_users ungültig.');
    }
    if (qDocs === undefined && body.quota_max_documents !== undefined && body.quota_max_documents !== null) {
      return apiError(400, 'VALIDATION_ERROR', 'quota_max_documents ungültig.');
    }
    if (qAi === undefined && body.quota_max_ai_queries_per_month !== undefined && body.quota_max_ai_queries_per_month !== null) {
      return apiError(400, 'VALIDATION_ERROR', 'quota_max_ai_queries_per_month ungültig.');
    }

    if (qUsers !== undefined) patch.quota_max_users = qUsers;
    if (qDocs !== undefined) patch.quota_max_documents = qDocs;
    if (qAi !== undefined) patch.quota_max_ai_queries_per_month = qAi;

    if (Object.keys(patch).length === 0) {
      return apiError(400, 'VALIDATION_ERROR', 'Keine Änderungen übermittelt.');
    }

    const { data: updated, error } = await supabase
      .from('schools')
      .update(patch)
      .eq('school_number', schoolNumber)
      .select(
        'school_number, name, active, created_at, initial_admin_app_user_id, quota_max_users, quota_max_documents, quota_max_ai_queries_per_month'
      )
      .maybeSingle();

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }
    if (!updated) {
      return apiError(404, 'NOT_FOUND', 'Schule nicht gefunden.');
    }

    return NextResponse.json({ school: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
