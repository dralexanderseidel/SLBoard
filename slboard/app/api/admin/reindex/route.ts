import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../lib/adminAuth';
import { getDocumentText } from '../../../../lib/documentText';
import { buildSearchIndex } from '../../../../lib/indexing';
import { getUserAccessContext } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';

type Payload = {
  limit?: number;
  offset?: number;
};

export async function POST(req: NextRequest) {
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

    const access = await getUserAccessContext(user.email, supabase);

    const body = (await req.json().catch(() => ({}))) as Payload;
    const limit = Math.max(1, Math.min(50, Number(body.limit) || 10));
    const offset = Math.max(0, Number(body.offset) || 0);

    let docsQuery = supabase
      .from('documents')
      .select('id, title, document_type_code, gremium, responsible_unit, participation_groups, legal_reference, summary, school_number')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (access.schoolNumber) docsQuery = docsQuery.eq('school_number', access.schoolNumber);
    const { data: docs, error } = await docsQuery;

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    const list = (docs ?? []) as Array<{
      id: string;
      title: string;
      document_type_code: string;
      gremium: string | null;
      responsible_unit: string | null;
      participation_groups: string[] | null;
      legal_reference: string | null;
      summary: string | null;
      school_number: string | null;
    }>;

    let ok = 0;
    let failed = 0;
    const failures: Array<{ id: string; error: string }> = [];

    for (const d of list) {
      try {
        const extractedText = await getDocumentText(d.id);
        const { keywords, searchText } = buildSearchIndex({
          title: d.title,
          documentType: d.document_type_code,
          gremium: d.gremium,
          responsibleUnit: d.responsible_unit,
          participationGroups: d.participation_groups,
          summary: d.summary,
          legalReference: d.legal_reference,
          extractedText,
        });
        let updQuery = supabase
          .from('documents')
          .update({ search_text: searchText, keywords, indexed_at: new Date().toISOString() })
          .eq('id', d.id);
        if (d.school_number) updQuery = updQuery.eq('school_number', d.school_number);
        const { error: updErr } = await updQuery;
        if (updErr) throw new Error(updErr.message);
        ok += 1;
      } catch (e: unknown) {
        failed += 1;
        failures.push({ id: d.id, error: e instanceof Error ? e.message : 'Unbekannter Fehler' });
      }
    }

    const nextOffset = offset + list.length;
    const done = list.length < limit;

    return NextResponse.json({
      ok,
      failed,
      processed: list.length,
      offset,
      nextOffset,
      done,
      failures: failures.slice(0, 5),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

