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
  aiQueriesTotal: number;
  aiQueriesLast7Days: number;
  aiQueriesByDay: AdminStatsDayPoint[];
};

function dayKeyUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

    let userQuery = supabase.from('app_users').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool);
    const { count: userCount, error: userErr } = await userQuery;
    if (userErr) {
      return apiError(500, 'INTERNAL_ERROR', userErr.message);
    }

    let docBase = supabase.from('documents').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool);
    const { count: documentTotal, error: docErr } = await docBase;
    if (docErr) {
      return apiError(500, 'INTERNAL_ERROR', docErr.message);
    }

    let docActiveQ = supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .is('archived_at', null);
    docActiveQ = docActiveQ.eq('school_number', adminSchool);
    const { count: documentActive, error: docActErr } = await docActiveQ;
    if (docActErr) {
      return apiError(500, 'INTERNAL_ERROR', docActErr.message);
    }

    let docArchQ = supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .not('archived_at', 'is', null);
    docArchQ = adminSchool ? docArchQ.eq('school_number', adminSchool) : docArchQ;
    const { count: documentArchived, error: docArchErr } = await docArchQ;
    if (docArchErr) {
      return apiError(500, 'INTERNAL_ERROR', docArchErr.message);
    }

    let docPubQ = supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'VEROEFFENTLICHT')
      .is('archived_at', null);
    docPubQ = docPubQ.eq('school_number', adminSchool);
    const { count: documentPublished, error: docPubErr } = await docPubQ;
    if (docPubErr) {
      return apiError(500, 'INTERNAL_ERROR', docPubErr.message);
    }

    let aiTotalQ = supabase.from('ai_queries').select('*', { count: 'exact', head: true }).eq('school_number', adminSchool);
    const { count: aiQueriesTotal, error: aiTotErr } = await aiTotalQ;
    if (aiTotErr) {
      return apiError(500, 'INTERNAL_ERROR', aiTotErr.message);
    }

    const since7 = new Date();
    since7.setUTCDate(since7.getUTCDate() - 7);
    since7.setUTCHours(0, 0, 0, 0);
    let aiLast7Q = supabase
      .from('ai_queries')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since7.toISOString());
    aiLast7Q = aiLast7Q.eq('school_number', adminSchool);
    const { count: aiQueriesLast7Days, error: ai7Err } = await aiLast7Q;
    if (ai7Err) {
      return apiError(500, 'INTERNAL_ERROR', ai7Err.message);
    }

    const since14 = new Date();
    since14.setUTCDate(since14.getUTCDate() - 14);
    since14.setUTCHours(0, 0, 0, 0);
    let aiRowsQ = supabase
      .from('ai_queries')
      .select('created_at')
      .gte('created_at', since14.toISOString())
      .limit(20000);
    aiRowsQ = adminSchool ? aiRowsQ.eq('school_number', adminSchool) : aiRowsQ;
    const { data: aiRows, error: aiRowsErr } = await aiRowsQ;
    if (aiRowsErr) {
      return apiError(500, 'INTERNAL_ERROR', aiRowsErr.message);
    }

    const byDayMap = new Map<string, number>();
    for (const row of aiRows ?? []) {
      const created = (row as { created_at?: string }).created_at;
      if (!created) continue;
      const k = dayKeyUtc(created);
      if (!k) continue;
      byDayMap.set(k, (byDayMap.get(k) ?? 0) + 1);
    }

    const dayLabels = lastNDaysUTC(14);
    const aiQueriesByDay: AdminStatsDayPoint[] = dayLabels.map((date) => ({
      date,
      count: byDayMap.get(date) ?? 0,
    }));

    const payload: AdminStatsPayload = {
      scope: 'school',
      schoolNumber: adminSchool,
      userCount: userCount ?? 0,
      documentTotal: documentTotal ?? 0,
      documentActive: documentActive ?? 0,
      documentArchived: documentArchived ?? 0,
      documentPublished: documentPublished ?? 0,
      aiQueriesTotal: aiQueriesTotal ?? 0,
      aiQueriesLast7Days: aiQueriesLast7Days ?? 0,
      aiQueriesByDay,
    };

    return NextResponse.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
