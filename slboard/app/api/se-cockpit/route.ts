import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../lib/supabaseServer';
import { resolveUserAccess } from '../../../lib/documentAccess';
import { apiError } from '../../../lib/apiError';
import { buildSeCockpitPayload } from '../../../lib/seCockpitAggregates';

const MAX_DOCS = 3000;

/**
 * GET: Aggregierte Steuerungsdaten für das Schulentwicklungs-Cockpit (Schule, nicht archivierte Dokumente mit gültiger V2-Analyse).
 */
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

    const access = await resolveUserAccess(user.email, supabase);
    const needsCtx = (access as { needsSchoolContext?: boolean }).needsSchoolContext === true;
    const schoolNumber = (access.schoolNumber ?? '').trim();

    if (needsCtx || !schoolNumber) {
      const empty = buildSeCockpitPayload([]);
      return NextResponse.json({
        ok: false as const,
        reason: needsCtx ? ('needs_school_context' as const) : ('no_school' as const),
        ...empty,
      });
    }

    const { data: rows, error } = await supabase
      .from('documents')
      .select('id, title, steering_analysis')
      .eq('school_number', schoolNumber)
      .is('archived_at', null)
      .not('steering_analysis', 'is', null)
      .limit(MAX_DOCS);

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    const payload = buildSeCockpitPayload((rows ?? []) as { id: string; title?: string | null; steering_analysis: unknown }[]);

    return NextResponse.json({
      ok: true as const,
      ...payload,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
