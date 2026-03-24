import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, getUserAccessContext } from '../../../../../lib/documentAccess';

/**
 * GET: Audit-Log für ein Dokument (wer hat was wann geändert).
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
      .select('id, responsible_unit, protection_class_id, school_number')
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

    let logQuery = supabase
      .from('audit_log')
      .select('id, user_email, action, old_values, new_values, created_at')
      .eq('entity_type', 'document')
      .eq('entity_id', documentId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (docSchool) logQuery = logQuery.eq('school_number', docSchool);
    const { data: logs, error: logError } = await logQuery;

    if (logError) {
      // Tabelle audit_log optional (Migration ggf. noch nicht ausgeführt)
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: logs ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
