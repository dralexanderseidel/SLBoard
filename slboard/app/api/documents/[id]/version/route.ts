import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { getDocumentText } from '../../../../../lib/documentText';
import { buildSearchIndex } from '../../../../../lib/indexing';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../../../lib/documentAccess';
import { apiError } from '../../../../../lib/apiError';
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.oasis.opendocument.text',
];
const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.oasis.opendocument.text': '.odt',
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

function nextVersionNumber(existing: string[]): string {
  if (existing.length === 0) return '1.1';
  const nums = existing.map((v) => parseFloat(v.replace(/^v?(\d+(?:\.\d+)?).*/, '$1'))).filter((n) => !Number.isNaN(n));
  if (nums.length === 0) return '1.1';
  const max = Math.max(...nums);
  return (Math.round((max + 0.1) * 10) / 10).toFixed(1);
}

/**
 * Neue Dateiversion zu einem bestehenden Dokument hochladen.
 */
export async function POST(
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
    const access = await resolveUserAccess(user.email, supabase);

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, responsible_unit, current_version_id, protection_class_id, school_number')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return apiError(404, 'NOT_FOUND', 'Dokument nicht gefunden.');
    }

    const docSchool = (doc as { school_number?: string | null }).school_number ?? null;
    const mayAccessSchool = canAccessSchool(access, docSchool);
    const mayEditByOrg =
      !access.hasAppUser ||
      access.isSchulleitung ||
      access.isSekretariat ||
      (!!access.orgUnit && access.orgUnit === (doc.responsible_unit ?? null));
    const mayEdit =
      mayAccessSchool &&
      mayEditByOrg &&
      canReadDocument(
        access,
        (doc as { protection_class_id?: number | null }).protection_class_id,
        doc.responsible_unit ?? null
      );
    if (!mayEdit) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung, dieses Dokument zu bearbeiten.');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const comment = (formData.get('comment') as string)?.trim() || 'Neue Version';

    if (!file || !(file instanceof File)) {
      return apiError(400, 'VALIDATION_ERROR', 'Keine gültige Datei übergeben.');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Datei zu groß. Max. ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }

    let mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      const extMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.odt': 'application/vnd.oasis.opendocument.text',
      };
      const ext = (file.name ?? '').toLowerCase().match(/\.(pdf|docx|doc|odt)$/)?.[0];
      const inferred = ext ? extMap[ext] : null;
      if (inferred) {
        mimeType = inferred;
      } else {
        return apiError(400, 'VALIDATION_ERROR', 'Nur PDF und Word (.pdf, .doc, .docx, .odt) erlaubt.');
      }
    }

    const ext = MIME_TO_EXT[mimeType] ?? '.pdf';
    const safeName = sanitizeFilename(file.name);
    if (safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
      return apiError(400, 'VALIDATION_ERROR', 'Ungültiger Dateiname.');
    }

    // Bestehende Versionsnummern holen
    let existingVersionsQuery = supabase
      .from('document_versions')
      .select('version_number')
      .eq('document_id', documentId);
    if (docSchool) existingVersionsQuery = existingVersionsQuery.eq('school_number', docSchool);
    const { data: existingVers } = await existingVersionsQuery;
    const versionNumbers = (existingVers ?? []).map((v) => v.version_number as string);
    const newVersion = nextVersionNumber(versionNumbers);

    const fileId = crypto.randomUUID();
    const schoolPrefix = docSchool ?? '000000';
    const filePath = `${schoolPrefix}/${documentId}/${fileId}${ext}`;

    const buffer = await file.arrayBuffer();
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) {
      return NextResponse.json(
        { error: `Speicher-Fehler: ${storageError.message}`, code: 'STORAGE_ERROR' },
        { status: 500 }
      );
    }

    const createdById = access.appUserId;

    const { data: verData, error: verError } = await supabase
      .from('document_versions')
      .insert({
        school_number: docSchool,
        document_id: documentId,
        version_number: newVersion,
        created_by_id: createdById,
        comment,
        file_uri: filePath,
        mime_type: mimeType,
        is_published: false,
      })
      .select('id, version_number, created_at')
      .single();

    if (verError || !verData) {
      await supabase.storage.from('documents').remove([filePath]);
      return NextResponse.json(
        { error: verError?.message ?? 'Version konnte nicht angelegt werden.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }

    let updateDocQuery = supabase
      .from('documents')
      .update({ current_version_id: verData.id, summary: null, summary_updated_at: null })
      .eq('id', documentId);
    if (docSchool) updateDocQuery = updateDocQuery.eq('school_number', docSchool);
    const { error: updateError } = await updateDocQuery;

    if (updateError) {
      return NextResponse.json(
        { error: 'Aktuelle Version konnte nicht gesetzt werden.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }

    // Phase A: Index aktualisieren (neue Datei → neuer Text)
    try {
      let docMetaQuery = supabase
        .from('documents')
        .select('title, document_type_code, gremium, responsible_unit, reach_scope, participation_groups, legal_reference')
        .eq('id', documentId);
      if (docSchool) docMetaQuery = docMetaQuery.eq('school_number', docSchool);
      const { data: docMeta } = await docMetaQuery.single();

      const extractedText = await getDocumentText(documentId);
      const { keywords, searchText } = buildSearchIndex({
        title: (docMeta?.title as string) ?? '',
        documentType: (docMeta?.document_type_code as string) ?? null,
        gremium: (docMeta?.gremium as string) ?? null,
        responsibleUnit: (docMeta?.responsible_unit as string) ?? null,
        reachScope: (docMeta?.reach_scope as string) ?? null,
        participationGroups: (docMeta?.participation_groups as string[] | null) ?? null,
        summary: null,
        legalReference: (docMeta?.legal_reference as string) ?? null,
        extractedText,
      });
      let updateIndexQuery = supabase
        .from('documents')
        .update({ search_text: searchText, keywords, indexed_at: new Date().toISOString() })
        .eq('id', documentId);
      if (docSchool) updateIndexQuery = updateIndexQuery.eq('school_number', docSchool);
      await updateIndexQuery;
    } catch {
      // Best-effort
    }

    const { error: auditErr } = await supabase.from('audit_log').insert({
      user_email: user.email,
      action: 'version.upload',
      entity_type: 'document',
      entity_id: documentId,
      school_number: docSchool,
      new_values: { version_id: verData.id, version_number: newVersion, comment },
    });
    if (auditErr) {
      // audit_log optional
    }

    return NextResponse.json({
      success: true,
      versionId: verData.id,
      versionNumber: verData.version_number,
      createdAt: verData.created_at,
      message: 'Neue Version wurde hochgeladen.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
