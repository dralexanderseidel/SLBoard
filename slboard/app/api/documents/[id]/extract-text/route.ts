import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { canReadDocument, getUserAccessContext } from '../../../../../lib/documentAccess';
import { getDocumentText } from '../../../../../lib/documentText';

/**
 * Diagnostics: Liefert nur Länge/Existenz von extrahierbarem Dokumenttext.
 * Kein Text selbst, um keine Inhalte versehentlich zu leaken.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = await createServerSupabaseClient();
    const {
      data: { user },
    } = (await client?.auth.getUser()) ?? { data: { user: null } };

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
      .select('id, protection_class_id, responsible_unit')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokument nicht gefunden.' }, { status: 404 });
    }

    const mayAccess = canReadDocument(
      access,
      (doc as { protection_class_id?: number | null }).protection_class_id,
      doc.responsible_unit ?? null
    );

    if (!mayAccess) {
      return NextResponse.json({ error: 'Keine Berechtigung für dieses Dokument.' }, { status: 403 });
    }

    const extractedText = await getDocumentText(documentId);
    const textLength = extractedText?.length ?? 0;

    return NextResponse.json({ documentId, textLength, hasText: textLength > 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

