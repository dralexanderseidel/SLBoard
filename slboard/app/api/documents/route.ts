import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, getUserAccessContext } from '../../../lib/documentAccess';
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
 * - status kann als einzelne Statuskennung oder als kommaseparierte Liste kommen
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

    const access = await getUserAccessContext(user.email, supabase);

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

    let query = supabase
      .from('documents')
      .select(
        'id, title, document_type_code, created_at, status, protection_class_id, reach_scope, gremium, responsible_unit, participation_groups, summary, steering_analysis, school_number'
      )
      .order('created_at', { ascending: false });

    if (access.schoolNumber) {
      query = query.eq('school_number', access.schoolNumber);
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

    const { data, error } = await query;

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    let filtered = (data ?? []).filter((d) =>
      canAccessSchool(access, d.school_number as string | null) &&
      canReadDocument(access, d.protection_class_id as number, d.responsible_unit as string | null)
    );

    if (steeringFilter === 'has') {
      filtered = filtered.filter((d) => isSteeringAnalysisPresent(d.steering_analysis));
    } else if (steeringFilter === 'missing') {
      filtered = filtered.filter((d) => !isSteeringAnalysisPresent(d.steering_analysis));
    } else if (
      steeringFilter === 'low' ||
      steeringFilter === 'medium' ||
      steeringFilter === 'high'
    ) {
      const expected = STEERING_GESAMT_BY_LEVEL[steeringFilter];
      filtered = filtered.filter((d) => steeringGesamtScore(d.steering_analysis) === expected);
    }

    return NextResponse.json({ data: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
