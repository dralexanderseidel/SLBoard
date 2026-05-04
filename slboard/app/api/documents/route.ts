import { NextRequest, NextResponse } from 'next/server';
import type { DocumentListItem } from '../../../app/documents/types';
import { supabaseServer } from '../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../lib/documentAccess';
import { apiError } from '../../../lib/apiError';
import { steeringListChipFromAnalysis, SCHULENTWICKLUNG_FIELDS } from '../../../lib/steeringAnalysisV2';

const STEERING_GESAMT_BY_LEVEL: Record<'low' | 'medium' | 'high', string> = {
  low: 'niedriger Steuerungsbedarf',
  medium: 'mittlerer Steuerungsbedarf',
  high: 'hoher Steuerungsbedarf',
};

const STEERING_RATING_BY_LEVEL: Record<'low' | 'medium' | 'high', string> = {
  low: 'robust',
  medium: 'instabil',
  high: 'kritisch',
};

function isSteeringAnalysisPresent(steering_analysis: unknown): boolean {
  const chip = steeringListChipFromAnalysis(steering_analysis);
  return Boolean(chip.overallRating || chip.legacyGesamt);
}

const LIST_SUMMARY_MAX_CHARS = 320;
/** Max. Zeilen aus der DB pro Anfrage (danach Berechtigungsfilter im Speicher). */
const DOCUMENT_LIST_FETCH_CAP = 2000;

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
  'steering_gesamt_legacy:steering_analysis->gesamtbewertung->>score',
  'steering_overall_rating:steering_analysis->overall->>rating',
].join(',');

function mapDocumentListRow(raw: Record<string, unknown>): Record<string, unknown> {
  const legacyRaw = raw.steering_gesamt_legacy;
  const ratingRaw = raw.steering_overall_rating;
  const { steering_gesamt_legacy: _lg, steering_overall_rating: _rt, ...rest } = raw;
  const legacy = typeof legacyRaw === 'string' ? legacyRaw.trim() : '';
  const rating = typeof ratingRaw === 'string' ? ratingRaw.trim() : '';
  let steering_analysis: DocumentListItem['steering_analysis'] = null;
  if (rating === 'robust' || rating === 'instabil' || rating === 'kritisch') {
    steering_analysis = { overall: { rating } };
  } else if (
    legacy === 'niedriger Steuerungsbedarf' ||
    legacy === 'mittlerer Steuerungsbedarf' ||
    legacy === 'hoher Steuerungsbedarf'
  ) {
    steering_analysis = { gesamtbewertung: { score: legacy } };
  }
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
 * - auftragfeld=<code> — nur Dokumente, die diesem Schulentwicklungs-Aufgabenfeld zugeordnet sind (Primär- oder
 *   Mehrfachzuordnung in schulentwicklung_*; nur sinnvoll mit steering=has)
 * - sePrimary=<code> — nur Dokumente mit gesetzter Steuerungsanalyse, deren primäres SE-Aufgabenfeld
 *   (schulentwicklung_primary_field) diesem Code entspricht
 * - archive=1 — nur archivierte Dokumente; sonst nur aktive (archived_at IS NULL)
 * - status kann als einzelne Statuskennung oder als kommaseparierte Liste kommen
 * - sort=created_at|title|status|document_type_code|review_date (Standard: created_at)
 * - sortDir=asc|desc (Standard: desc)
 *
 * Antwort enthält optional `meta`: `{ total, truncated }` — `truncated` wenn die DB-Abfrage
 * am Abruflimit anstößt (es können weitere Zeilen existieren, die nach Berechtigungsfilter
 * nicht mitgezählt werden).
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
    const auftragfeldRaw = (searchParams.get('auftragfeld') ?? '').trim();
    const sePrimaryRaw = (searchParams.get('sePrimary') ?? '').trim();
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

    const auftragfeldOk = (SCHULENTWICKLUNG_FIELDS as readonly string[]).includes(auftragfeldRaw);
    if (auftragfeldOk) {
      query = query
        .not('steering_analysis', 'is', null)
        .or(
          `schulentwicklung_primary_field.eq.${auftragfeldRaw},schulentwicklung_fields.cs.{${auftragfeldRaw}}`,
        );
    }

    const sePrimaryOk = (SCHULENTWICKLUNG_FIELDS as readonly string[]).includes(sePrimaryRaw);
    if (sePrimaryOk) {
      query = query.not('steering_analysis', 'is', null).eq('schulentwicklung_primary_field', sePrimaryRaw);
    }

    // Steering-Filter: has / low|medium|high (neues overall.rating oder Legacy-Score)
    if (steeringFilter === 'has') {
      const legacyScores = Object.values(STEERING_GESAMT_BY_LEVEL);
      const newRatings = ['robust', 'instabil', 'kritisch'];
      query = query.or(
        [...newRatings.map((r) => `steering_analysis->overall->>rating.eq.${r}`), ...legacyScores.map(
          (v) => `steering_analysis->gesamtbewertung->>score.eq.${v}`,
        )].join(','),
      );
    } else if (steeringFilter === 'low' || steeringFilter === 'medium' || steeringFilter === 'high') {
      const rating = STEERING_RATING_BY_LEVEL[steeringFilter];
      const legacy = STEERING_GESAMT_BY_LEVEL[steeringFilter];
      query = query.or(
        `steering_analysis->overall->>rating.eq.${rating},steering_analysis->gesamtbewertung->>score.eq.${legacy}`,
      );
    }
    // 'missing' wird nach dem Fetch in-memory gefiltert (erfordert Negation des JSON-Pfads)

    query = query.order(sortColumn as 'created_at' | 'title' | 'status' | 'document_type_code' | 'review_date', {
      ascending,
    });

    query = query.limit(DOCUMENT_LIST_FETCH_CAP);

    const { data, error } = await query;

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    const rawRows = data ?? [];
    const dbTruncated = rawRows.length >= DOCUMENT_LIST_FETCH_CAP;

    const mapped = rawRows.map((d) => mapDocumentListRow(d as unknown as Record<string, unknown>));

    let filtered = mapped.filter((d) =>
      canAccessSchool(access, d.school_number as string | null) &&
      canReadDocument(access, d.protection_class_id as number, d.responsible_unit as string | null)
    );

    if (steeringFilter === 'missing') {
      filtered = filtered.filter((d) => !isSteeringAnalysisPresent(d.steering_analysis));
    }

    return NextResponse.json({
      data: filtered,
      meta: { total: filtered.length, truncated: dbTruncated },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
