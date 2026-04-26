import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { isSuperAdmin } from '../../../../lib/superAdminAuth';
import { provisionSchoolAndAdmin, type SchoolQuotasInput } from '../../../../lib/schoolProvisioning';
import { apiError } from '../../../../lib/apiError';

type UsageRow = {
  school_number: string;
  user_count: number;
  document_count: number;
  ai_queries_total: number;
  ai_queries_month: number;
  llm_calls_total: number;
  llm_calls_month: number;
};

function parseQuota(n: unknown): number | null | undefined {
  if (n === undefined) return undefined;
  if (n === null || n === '') return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return undefined;
  return Math.floor(v);
}

export async function GET() {
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

    const { data: schools, error: schoolErr } = await supabase
      .from('schools')
      .select(
        'school_number, name, active, created_at, initial_admin_app_user_id, quota_max_users, quota_max_documents, quota_max_ai_queries_per_month, feature_ai_enabled, feature_drafts_enabled, max_upload_file_mb'
      )
      .order('school_number');

    if (schoolErr) {
      return apiError(500, 'INTERNAL_ERROR', schoolErr.message);
    }

    const { data: statsRows, error: rpcErr } = await supabase.rpc('school_usage_stats');
    if (rpcErr) {
      return apiError(500, 'INTERNAL_ERROR', rpcErr.message);
    }

    const usageBySchool = new Map<string, UsageRow>();
    for (const row of (statsRows ?? []) as UsageRow[]) {
      usageBySchool.set(String(row.school_number ?? '').trim(), row);
    }

    const adminIds = [
      ...new Set(
        (schools ?? [])
          .map((s) => (s as { initial_admin_app_user_id?: string | null }).initial_admin_app_user_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const adminById = new Map<string, { email: string; full_name: string | null }>();
    if (adminIds.length > 0) {
      const { data: admins, error: admErr } = await supabase
        .from('app_users')
        .select('id, email, full_name')
        .in('id', adminIds);
      if (admErr) {
        return apiError(500, 'INTERNAL_ERROR', admErr.message);
      }
      for (const a of admins ?? []) {
        adminById.set(a.id as string, {
          email: String((a as { email?: string }).email ?? '').trim().toLowerCase(),
          full_name: ((a as { full_name?: string | null }).full_name ?? null) as string | null,
        });
      }
    }

    const schoolsWithUsage = (schools ?? []).map((s) => {
      const sn = String(s.school_number ?? '').trim();
      const u = usageBySchool.get(sn);
      const initId = (s as { initial_admin_app_user_id?: string | null }).initial_admin_app_user_id ?? null;
      const adm = initId ? adminById.get(initId) : undefined;
      return {
        ...s,
        initial_admin_email: adm?.email ?? null,
        initial_admin_full_name: adm?.full_name ?? null,
        usage: {
          userCount: Number(u?.user_count ?? 0),
          documentCount: Number(u?.document_count ?? 0),
          aiQueriesTotal: Number(u?.ai_queries_total ?? 0),
          aiQueriesThisMonth: Number(u?.ai_queries_month ?? 0),
          llmCallsTotal: Number(u?.llm_calls_total ?? 0),
          llmCallsThisMonth: Number(u?.llm_calls_month ?? 0),
        },
      };
    });

    return NextResponse.json({ schools: schoolsWithUsage });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

export async function POST(req: NextRequest) {
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

    const body = (await req.json()) as Record<string, unknown>;
    const schoolNumber = String(body.schoolNumber ?? '').trim();
    const schoolName = String(body.schoolName ?? '').trim();
    const adminFullName = String(body.adminFullName ?? '').trim();
    const adminEmail = String(body.adminEmail ?? '')
      .trim()
      .toLowerCase();
    const adminPassword = String(body.adminPassword ?? '');

    const quota_max_users = parseQuota(body.quota_max_users);
    const quota_max_documents = parseQuota(body.quota_max_documents);
    const quota_max_ai_queries_per_month = parseQuota(body.quota_max_ai_queries_per_month);

    if (quota_max_users === undefined && body.quota_max_users !== undefined && body.quota_max_users !== null) {
      return apiError(400, 'VALIDATION_ERROR', 'quota_max_users ungültig.');
    }
    if (quota_max_documents === undefined && body.quota_max_documents !== undefined && body.quota_max_documents !== null) {
      return apiError(400, 'VALIDATION_ERROR', 'quota_max_documents ungültig.');
    }
    if (
      quota_max_ai_queries_per_month === undefined &&
      body.quota_max_ai_queries_per_month !== undefined &&
      body.quota_max_ai_queries_per_month !== null
    ) {
      return apiError(400, 'VALIDATION_ERROR', 'quota_max_ai_queries_per_month ungültig.');
    }

    if (!/^\d{6}$/.test(schoolNumber)) {
      return apiError(400, 'VALIDATION_ERROR', 'Schulnummer muss 6-stellig sein.');
    }
    if (!schoolName) {
      return apiError(400, 'VALIDATION_ERROR', 'Schulname ist erforderlich.');
    }
    if (!adminFullName) {
      return apiError(400, 'VALIDATION_ERROR', 'Name des Schuladmins ist erforderlich.');
    }
    if (!adminEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
      return apiError(400, 'VALIDATION_ERROR', 'Gültige Admin-E-Mail ist erforderlich.');
    }
    if (!adminPassword || adminPassword.length < 10) {
      return apiError(400, 'VALIDATION_ERROR', 'Passwort muss mindestens 10 Zeichen haben.');
    }

    const { data: existingSchool } = await supabase
      .from('schools')
      .select('school_number')
      .eq('school_number', schoolNumber)
      .maybeSingle();
    if (existingSchool) {
      return apiError(409, 'BAD_REQUEST', 'Diese Schulnummer ist bereits vergeben.');
    }

    const quotas: SchoolQuotasInput = {};
    if (quota_max_users !== undefined) quotas.quota_max_users = quota_max_users;
    if (quota_max_documents !== undefined) quotas.quota_max_documents = quota_max_documents;
    if (quota_max_ai_queries_per_month !== undefined) {
      quotas.quota_max_ai_queries_per_month = quota_max_ai_queries_per_month;
    }
    const hasQuotas = Object.keys(quotas).length > 0;

    try {
      await provisionSchoolAndAdmin(supabase, {
        schoolNumber,
        schoolName,
        adminFullName,
        adminEmail,
        adminPassword,
        quotas: hasQuotas ? quotas : null,
      });
    } catch (e) {
      return apiError(500, 'INTERNAL_ERROR', e instanceof Error ? e.message : 'Schule konnte nicht angelegt werden.');
    }

    return NextResponse.json({
      ok: true,
      schoolNumber,
      message: 'Schule und Schuladmin wurden angelegt.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
