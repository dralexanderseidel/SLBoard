import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, getUserAccessContext } from '../../../../../lib/documentAccess';
import { apiError } from '../../../../../lib/apiError';

/**
 * Erzeugt eine temporäre Signed URL für die Datei eines Dokuments.
 * Prüft: eingeloggter Nutzer, Rechte (Rolle / responsible_unit).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: documentId } = await params;
    const access = await getUserAccessContext(user.email, supabase);
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get('versionId');

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, current_version_id, responsible_unit, protection_class_id, school_number')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return apiError(404, 'NOT_FOUND', 'Dokument nicht gefunden.');
    }

    const docSchool = (doc as { school_number?: string | null }).school_number ?? null;
    const mayAccessSchool = canAccessSchool(access, docSchool);
    const mayAccess = canReadDocument(
      access,
      (doc as { protection_class_id?: number | null }).protection_class_id,
      doc.responsible_unit ?? null
    );
    if (!mayAccessSchool || !mayAccess) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für dieses Dokument.');
    }

    // Bestimmte Version (versionId) oder aktuelle Version
    const versionToUse = versionId && versionId.trim() ? versionId.trim() : (doc.current_version_id as string);
    if (!versionToUse) {
      return apiError(404, 'NOT_FOUND', 'Dokument oder Version nicht gefunden.');
    }

    let versionQuery = supabase
      .from('document_versions')
      .select('file_uri')
      .eq('id', versionToUse)
      .eq('document_id', documentId);
    if (docSchool) versionQuery = versionQuery.eq('school_number', docSchool);
    const { data: ver, error: verError } = await versionQuery.single();

    if (verError || !ver?.file_uri) {
      return apiError(404, 'NOT_FOUND', 'Datei-Pfad nicht gefunden.');
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUrl(ver.file_uri, 3600); // 1 Stunde gültig

    if (signedError) {
      return apiError(500, 'INTERNAL_ERROR', signedError.message ?? 'Signed URL konnte nicht erzeugt werden.');
    }

    return NextResponse.json({ signedUrl: signed.signedUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
