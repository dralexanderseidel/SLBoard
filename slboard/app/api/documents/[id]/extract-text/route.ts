import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../../../lib/documentAccess';
import { apiError } from '../../../../../lib/apiError';

export const runtime = 'nodejs';

export const maxDuration = 60;

/**
 * Diagnostics: Liefert nur Länge/Existenz von extrahierbarem Dokumenttext.
 * Kein Text selbst, um keine Inhalte versehentlich zu leaken.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = await createServerSupabaseClient();
    const {
      data: { user },
    } = (await client?.auth.getUser()) ?? { data: { user: null } };

    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    const { id: documentId } = await params;
    const verbose = req.nextUrl.searchParams.get('verbose') === '1';

    const access = await resolveUserAccess(user.email, supabase);

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, protection_class_id, responsible_unit, school_number')
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
      return NextResponse.json(
        {
          error: 'Keine Berechtigung für dieses Dokument.',
          reason: !mayAccessSchool ? 'school_mismatch' : 'protection_denied',
          debug: {
            userSchoolNumber: access.schoolNumber,
            documentSchoolNumber: docSchool,
            protectionClassId: (doc as { protection_class_id?: number | null }).protection_class_id ?? null,
            userRoles: access.roles,
          },
        },
        { status: 403 }
      );
    }

    const { getDocumentTextDiagnostics } = await import('../../../../../lib/documentText');
    const diag = await getDocumentTextDiagnostics(documentId);
    const debugBase = {
      currentVersionId: diag.currentVersionId,
      fileUri: diag.fileUri,
      mimeType: diag.mimeType,
      normalizedMime: diag.normalizedMime,
      extractionMethod: diag.extractionMethod,
      usedLegalReference: diag.usedLegalReference,
      attemptedDownload: diag.attemptedDownload,
      downloadError: diag.downloadError,
      parserError: diag.parserError,
    };
    return NextResponse.json({
      documentId,
      hasText: diag.textLength > 0,
      textLength: diag.textLength,
      debug: verbose
        ? {
            ...debugBase,
            fileSizeBytes: diag.fileSizeBytes,
            fileSha256: diag.fileSha256,
            pdfParseTextLength: diag.pdfParseTextLength,
            pdfParsePagesTextLength: diag.pdfParsePagesTextLength,
            pdfParseError: diag.pdfParseError,
            pdfJsTextLength: diag.pdfJsTextLength,
            pdfJsError: diag.pdfJsError,
          }
        : debugBase,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}

