import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../lib/documentAccess';
import { apiError } from '../../../lib/apiError';

const STEERING_GESAMT_BY_LEVEL: Record<'low' | 'medium' | 'high', string> = {
  low: 'niedriger Steuerungsbedarf',
  medium: 'mittlerer Steuerungsbedarf',
  high: 'hoher Steuerungsbedarf',
};

/** Entspricht der Anzeige-Logik in app/documents/page.tsx (steeringNeedScore). */
function steeringGesamtScore(steering_analysis: unknown): string | undefined {
  const score =
    steering_analysis &&
    typeof steering_analysis === 'object' &&
    'gesamtbewertung' in steering_analysis
      ? (steering_analysis as { gesamtbewertung?: { score?: string } }).gesamtbewertung?.score
      : undefined;
  return typeof score === 'string' ? score : undefined;
}

function isSteeringAnalysisPresent(steering_analysis: unknown): boolean {
  const score = steeringGesamtScore(steering_analysis);
  return (
    score === 'niedriger Steuerungsbedarf' ||
    score === 'mittlerer Steuerungsbedarf' ||
    score === 'hoher Steuerungsbedarf'
  );
}

const LIST_SUMMARY_MAX_CHARS = 320;

/** Liste: nur Gesamtbewertung aus JSON (PostgREST-Pfad), kein vollständiges steering_analysis. */
const DOCUMENT_LIST_SELECT = [
  'id',
  'title',
  'document_type_code',
  'created_at',
  'status',
  'protection_class_id',
  'reach_scope',
  'gremium',
  'responsible_unit',
  'participation_groups',
  'review_date',
  'summary',
  'school_number',
  'archived_at',
  'steering_gesamt_score:steering_analysis->gesamtbewertung->>score',
].join(',');

function mapDocumentListRow(raw: Record<string, unknown>): Record<string, unknown> {
  const scoreRaw = raw.steering_gesamt_score;
  const { steering_gesamt_score: _sg, ...rest } = raw;
  const score = typeof scoreRaw === 'string' ? scoreRaw.trim() : '';
  const steering_analysis =
    score === 'niedriger Steuerungsbedarf' ||
    score === 'mittlerer Steuerungsbedarf' ||
    score === 'hoher Steuerungsbedarf'
      ? { gesamtbewertung: { score } }
      : null;
  let summary = rest.summary;
  if (typeof summary === 'string' && summary.length > LIST_SUMMARY_MAX_CHARS) {
    summary = `${summary.slice(0, LIST_SUMMARY_MAX_CHARS)}…`;
  }
  return { ...rest, summary, steering_analysis };
}

/**
 * GET: Dokumentenliste mit Berechtigungs- und Schutzklassenfilter.
 * Query-Parameter:
 * - type, responsibleUnit, status, protectionClass, search
 * - reachScope (intern|extern oder kommasepariert)
 * - participation (eine oder mehrere Gruppen, kommasepariert) → participation_groups enthält alle angegebenen Gruppen
 * - gremium (Freitext, ilike)
 * - review (overdue|set|empty)
 * - summary (has|missing)
 * - steering (has|missing|low|medium|high) — Steuerungsanalyse; low/medium/high = Ampel (Gesamtbewertung)
 * - archive=1 — nur archivierte Dokumente; sonst nur aktive (archived_at IS NULL)
 * - status kann als einzelne Statuskennung oder als kommaseparierte Liste kommen
 * - sort=created_at|title|status|document_type_code|review_date (Standard: created_at)
 * - sortDir=asc|desc (Standard: desc)
 */
export async function GET(req: NextRequest) {
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

    const access = await resolveUserAccess(user.email, supabase);

    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type') ?? '';
    const responsibleUnitFilter = searchParams.get('responsibleUnit') ?? '';
    const statusFilterRaw = searchParams.get('status') ?? '';
    const protectionFilter = searchParams.get('protectionClass') ?? '';
    const searchQuery = searchParams.get('search') ?? '';
    const reachScopeRaw = searchParams.get('reachScope') ?? '';
    const participationRaw = searchParams.get('participation') ?? '';
    const gremiumFilter = searchParams.get('gremium') ?? '';
    const reviewFilter = searchParams.get('review') ?? '';
    const summaryFilter = searchParams.get('summary') ?? '';
    const steeringFilter = searchParams.get('steering') ?? '';
    const archiveParam = searchParams.get('archive') ?? '';
    const sortRaw = (searchParams.get('sort') ?? 'created_at').trim();
    const sortDirRaw = (searchParams.get('sortDir') ?? 'desc').trim().toLowerCase();
    const allowedSort = new Set(['created_at', 'title', 'status', 'document_type_code', 'review_date']);
    const sortColumn = allowedSort.has(sortRaw) ? sortRaw : 'created_at';
    const ascending = sortDirRaw === 'asc';

    let query = supabase.from('documents').select(DOCUMENT_LIST_SELECT);

    if (access.schoolNumber) {
      query = query.eq('school_number', access.schoolNumber);
    }

    if (archiveParam === '1') {
      query = query.not('archived_at', 'is', null);
    } else {
      query = query.is('archived_at', null);
    }

    if (searchQuery.trim()) {
      const pattern = `%${searchQuery.trim()}%`;
      // Volltextsuche: Metadaten + inhaltsbasiert (summary, legal_reference, search_text)
      query = query.or(
        [
          `title.ilike.${pattern}`,
          `document_type_code.ilike.${pattern}`,
          `gremium.ilike.${pattern}`,
          `summary.ilike.${pattern}`,
          `legal_reference.ilike.${pattern}`,
          `search_text.ilike.${pattern}`,
        ].join(',')
      );
    }

    if (typeFilter) {
      query = query.eq('document_type_code', typeFilter);
    }

    if (responsibleUnitFilter.trim()) {
      query = query.eq('responsible_unit', responsibleUnitFilter.trim());
    }

    if (statusFilterRaw) {
      const ALLOWED_STATUSES = ['ENTWURF', 'FREIGEGEBEN', 'BESCHLUSS', 'VEROEFFENTLICHT'] as const;
      const statusList = statusFilterRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s): s is (typeof ALLOWED_STATUSES)[number] => (ALLOWED_STATUSES as readonly string[]).includes(s));

      if (statusList.length === 1) {
        query = query.eq('status', statusList[0]);
      } else if (statusList.length > 1) {
        query = query.in('status', statusList);
      }
    }

    if (protectionFilter) {
      const pc = Number(protectionFilter);
      if (!Number.isNaN(pc)) {
        query = query.eq('protection_class_id', pc);
      }
    }

    if (reachScopeRaw.trim()) {
      const allowed = new Set(['intern', 'extern']);
      const list = reachScopeRaw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .filter((s) => allowed.has(s));
      if (list.length === 1) {
        query = query.eq('reach_scope', list[0]);
      } else if (list.length > 1) {
        query = query.in('reach_scope', list);
      }
    }

    if (participationRaw.trim()) {
      const groups = participationRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      if (groups.length > 0) {
        query = query.contains('participation_groups', groups);
      }
    }

    if (gremiumFilter.trim()) {
      query = query.ilike('gremium', `%${gremiumFilter.trim()}%`);
    }

    if (reviewFilter === 'overdue' || reviewFilter === 'set' || reviewFilter === 'empty') {
      if (reviewFilter === 'set') {
        query = query.not('review_date', 'is', null);
      } else if (reviewFilter === 'empty') {
        query = query.is('review_date', null);
      } else {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayIso = `${yyyy}-${mm}-${dd}`;
        query = query.not('review_date', 'is', null).lt('review_date', todayIso);
      }
    }

    if (summaryFilter === 'has') {
      query = query.not('summary', 'is', null);
    } else if (summaryFilter === 'missing') {
      query = query.is('summary', null);
    }

    // Steering-Filter: has/low/medium/high direkt in SQL via JSON-Operator
    if (steeringFilter === 'has') {
      query = query.or(
        Object.values(STEERING_GESAMT_BY_LEVEL)
          .map((v) => `steering_analysis->gesamtbewertung->>score.eq.${v}`)
          .join(',')
      );
    } else if (steeringFilter === 'low' || steeringFilter === 'medium' || steeringFilter === 'high') {
      query = query.filter(
        'steering_analysis->gesamtbewertung->>score',
        'eq',
        STEERING_GESAMT_BY_LEVEL[steeringFilter]
      );
    }
    // 'missing' wird nach dem Fetch in-memory gefiltert (erfordert Negation des JSON-Pfads)

    query = query.order(sortColumn as 'created_at' | 'title' | 'status' | 'document_type_code' | 'review_date', {
      ascending,
    });

    // Sicherheitsnetz: max. 500 Dokumente pro Anfrage
    query = query.limit(500);

    const { data, error } = await query;

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    const mapped = (data ?? []).map((d) => mapDocumentListRow(d as unknown as Record<string, unknown>));

    let filtered = mapped.filter((d) =>
      canAccessSchool(access, d.school_number as string | null) &&
      canReadDocument(access, d.protection_class_id as number, d.responsible_unit as string | null)
    );

    if (steeringFilter === 'missing') {
      filtered = filtered.filter((d) => !isSteeringAnalysisPresent(d.steering_analysis));
    }

    return NextResponse.json({ data: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
