import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, getUserAccessContext } from '../../../../lib/documentAccess';

/**
 * GET: Kürzlich veröffentlichte Dokumente (Hinweis für Gremien).
 * Nutzt audit_log: Einträge, bei denen Status auf VEROEFFENTLICHT gesetzt wurde.
 */
export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    }

    const access = await getUserAccessContext(user.email, supabase);

    let auditQuery = supabase
      .from('audit_log')
      .select('entity_id, created_at, new_values, old_values, school_number')
      .eq('entity_type', 'document')
      .eq('action', 'document.update')
      .not('new_values', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (access.schoolNumber) auditQuery = auditQuery.eq('school_number', access.schoolNumber);
    const { data: auditEntries, error: auditError } = await auditQuery;

    if (auditError) {
      return NextResponse.json({ data: [] });
    }

    const publishedEvents = (auditEntries ?? []).filter((e) => {
      const nv = e.new_values as { status?: string } | null;
      const ov = e.old_values as { status?: string } | null;
      if (nv?.status !== 'VEROEFFENTLICHT') return false;
      if (ov?.status === 'VEROEFFENTLICHT') return false;
      return true;
    });

    const documentIds = [...new Set(publishedEvents.map((e) => e.entity_id as string))].slice(0, 15);
    if (documentIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const query = supabase
      .from('documents')
      .select('id, title, responsible_unit, protection_class_id, school_number')
      .in('id', documentIds)
      .eq('status', 'VEROEFFENTLICHT');

    const { data: docs, error: docsError } = await query;

    if (docsError || !docs?.length) {
      return NextResponse.json({ data: [] });
    }

    const byId = new Map<string, string>();
    for (const e of publishedEvents) {
      const id = e.entity_id as string;
      if (!byId.has(id)) byId.set(id, e.created_at as string);
    }
    const result = docs
      .filter((d) =>
        canAccessSchool(access, d.school_number as string | null) &&
        canReadDocument(access, d.protection_class_id as number, d.responsible_unit as string | null)
      )
      .map((d) => ({
        documentId: d.id,
        title: d.title,
        publishedAt: byId.get(d.id) ?? new Date().toISOString(),
      }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 10);

    return NextResponse.json({ data: result });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
