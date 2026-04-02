import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, getUserAccessContext } from '../../../lib/documentAccess';
import { apiError } from '../../../lib/apiError';

/**
 * GET: Dokumentenliste mit Berechtigungs- und Schutzklassenfilter.
 * Query-Parameter: type, status, protectionClass, search
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
    const statusFilterRaw = searchParams.get('status') ?? '';
    const protectionFilter = searchParams.get('protectionClass') ?? '';
    const searchQuery = searchParams.get('search') ?? '';

    let query = supabase
      .from('documents')
      .select(
        'id, title, document_type_code, created_at, status, protection_class_id, gremium, responsible_unit, participation_groups, summary, school_number'
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

    if (statusFilterRaw) {
      const ALLOWED_STATUSES = ['ENTWURF', 'FREIGEGEBEN', 'VEROEFFENTLICHT'] as const;
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

    const { data, error } = await query;

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    const filtered = (data ?? []).filter((d) =>
      canAccessSchool(access, d.school_number as string | null) &&
      canReadDocument(access, d.protection_class_id as number, d.responsible_unit as string | null)
    );

    return NextResponse.json({ data: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
