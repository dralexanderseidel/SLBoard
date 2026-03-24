import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, getUserAccessContext } from '../../../../../lib/documentAccess';

/**
 * GET: Alle Versionen eines Dokuments (für Versionen-Historie).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: documentId } = await params;
    const access = await getUserAccessContext(user.email, supabase);

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, responsible_unit, current_version_id, protection_class_id, school_number')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokument nicht gefunden.' }, { status: 404 });
    }

    const docSchool = (doc as { school_number?: string | null }).school_number ?? null;
    const mayAccessSchool = canAccessSchool(access, docSchool);
    const mayAccess = canReadDocument(
      access,
      (doc as { protection_class_id?: number | null }).protection_class_id,
      doc.responsible_unit ?? null
    );
    if (!mayAccessSchool || !mayAccess) {
      return NextResponse.json({ error: 'Keine Berechtigung für dieses Dokument.' }, { status: 403 });
    }

    let versionsQuery = supabase
      .from('document_versions')
      .select('id, version_number, created_at, comment, mime_type')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });
    if (docSchool) versionsQuery = versionsQuery.eq('school_number', docSchool);
    const { data: versions, error: verError } = await versionsQuery;

    if (verError) {
      return NextResponse.json({ error: verError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: (versions ?? []).map((v) => ({
        id: v.id,
        version_number: v.version_number,
        created_at: v.created_at,
        comment: v.comment ?? null,
        mime_type: v.mime_type ?? null,
        is_current: v.id === doc.current_version_id,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
