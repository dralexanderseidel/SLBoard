import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../lib/adminAuth';
import { resolveUserAccess } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';

export type AdminStatsDayPoint = { date: string; count: number };

export type AdminStatsPayload = {
  /** Immer Schulstatistik; globale Übersicht folgt später (Super-Admin). */
  scope: 'school';
  schoolNumber: string;
  userCount: number;
  documentTotal: number;
  documentActive: number;
  documentArchived: number;
  documentPublished: number;
  /** Physische LLM-Antworten (ai_llm_calls). */
  llmCallsTotal: number;
  llmCallsLast7Days: number;
  llmCallsThisMonth: number;
  llmCallsByDay: AdminStatsDayPoint[];
  /** Gespeicherte Dashboard-KI-Anfragen (ai_queries). */
  aiQueriesTotal: number;
  aiQueriesLast7Days: number;
  aiQueriesByDay: AdminStatsDayPoint[];
  /** Quotas (null = unbegrenzt). */
  quotaMaxUsers: number | null;
  quotaMaxDocuments: number | null;
  quotaMaxAiQueriesPerMonth: number | null;
};


function lastNDaysUTC(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
  }
  return out;
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

    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const access = await resolveUserAccess(user.email, supabase);
    const adminSchool = (access.schoolNumber ?? '').trim();
    if (!adminSchool) {
      return apiError(
        400,
        'VALIDATION_ERROR',
        'Statistik ist nur mit Schulzuordnung verfügbar. Bitte school_number im Nutzerprofil setzen.',
      );
    }

    const since7 = new Date();
    since7.setUTCDate(since7.getUTCDate() - 7);
    since7.setUTCHours(0, 0, 0, 0);
    const since7iso = since7.toISOString();

    const since14 = new Date();
    since14.setUTCDate(since14.getUTCDate() - 14);
    since14.setUTCHours(0, 0, 0, 0);
    const since14iso = since14.toISOString();

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();

    const [
      { count: userCount, error: userErr },
      { count: documentTotal, error: docErr },
      { count: documentActive, error: docActErr },
      { count: documentArchived, error: docArchErr },
      { count: documentPublished, error: docPubErr },
      { count: llmCallsTotal, error: llmTotErr },
      { count: aiQueriesTotal, error: aiTotErr },
      { count: llmCallsLast7Days, error: llm7Err },
      { count: aiQueriesLast7Days, error: ai7Err },
      { count: llmCallsThisMonth, error: llmMonthErr },
      { data: schoolQuota, error: quotaErr },
    ] = await Promise.all([
      supabase.from('app_users').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool),
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool),
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool).is('archived_at', null),
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool).not('archived_at', 'is', null),
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool).eq('status', 'VEROEFFENTLICHT').is('archived_at', null),
      supabase.from('ai_llm_calls').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool),
      supabase.from('ai_queries').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool),
      supabase.from('ai_llm_calls').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool).gte('created_at', since7iso),
      supabase.from('ai_queries').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool).gte('created_at', since7iso),
      supabase.from('ai_llm_calls').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool).gte('created_at', monthStartIso),
      supabase.from('schools').select('quota_max_users, quota_max_documents, quota_max_ai_queries_per_month').eq('school_number', adminSchool).maybeSingle(),
    ]);

    const firstErr = userErr ?? docErr ?? docActErr ?? docArchErr ?? docPubErr ?? llmTotErr ?? aiTotErr ?? llm7Err ?? ai7Err ?? llmMonthErr ?? quotaErr;
    if (firstErr) {
      return apiError(500, 'INTERNAL_ERROR', firstErr.message);
    }

    const quota = schoolQuota as { quota_max_users?: number | null; quota_max_documents?: number | null; quota_max_ai_queries_per_month?: number | null } | null;

    // Aggregierte Tageswerte via SQL – gibt nur aktive Tage zurück (max. ~14 Zeilen je Serie)
    const { data: activityRows, error: activityErr } = await supabase.rpc(
      'admin_stats_activity_by_day',
      { p_school_number: adminSchool, p_since: since14iso }
    );
    if (activityErr) {
      return apiError(500, 'INTERNAL_ERROR', activityErr.message);
    }

    type ActivityRow = { series: string; day: string; count: number };
    const byDayLlm = new Map<string, number>();
    const byDayAi = new Map<string, number>();
    for (const row of (activityRows ?? []) as ActivityRow[]) {
      if (row.series === 'llm_calls') byDayLlm.set(row.day, Number(row.count));
      else if (row.series === 'ai_queries') byDayAi.set(row.day, Number(row.count));
    }

    const dayLabels = lastNDaysUTC(14);
    const llmCallsByDay: AdminStatsDayPoint[] = dayLabels.map((date) => ({
      date,
      count: byDayLlm.get(date) ?? 0,
    }));
    const aiQueriesByDay: AdminStatsDayPoint[] = dayLabels.map((date) => ({
      date,
      count: byDayAi.get(date) ?? 0,
    }));

    const payload: AdminStatsPayload = {
      scope: 'school',
      schoolNumber: adminSchool,
      userCount: userCount ?? 0,
      documentTotal: documentTotal ?? 0,
      documentActive: documentActive ?? 0,
      documentArchived: documentArchived ?? 0,
      documentPublished: documentPublished ?? 0,
      llmCallsTotal: llmCallsTotal ?? 0,
      llmCallsLast7Days: llmCallsLast7Days ?? 0,
      llmCallsThisMonth: llmCallsThisMonth ?? 0,
      llmCallsByDay,
      aiQueriesTotal: aiQueriesTotal ?? 0,
      aiQueriesLast7Days: aiQueriesLast7Days ?? 0,
      aiQueriesByDay,
      quotaMaxUsers: quota?.quota_max_users ?? null,
      quotaMaxDocuments: quota?.quota_max_documents ?? null,
      quotaMaxAiQueriesPerMonth: quota?.quota_max_ai_queries_per_month ?? null,
    };

    return NextResponse.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
