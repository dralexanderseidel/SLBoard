import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../lib/supabaseServerClient';
import { buildSearchIndex } from '../../../lib/indexing';
import { resolveUserAccess } from '../../../lib/documentAccess';
import { apiError } from '../../../lib/apiError';
import { WORKFLOW_STATUS_ORDER } from '../../../lib/documentWorkflow';
import { callLlm, isLlmConfigured } from '../../../lib/llmClient';
import { getAiSettingsForSchool } from '../../../lib/aiSettings';
import { getSchoolPromptTemplate, renderPromptTemplate } from '../../../lib/aiPromptTemplates';
import { ensureGlobalDocumentTypeRows } from '../../../lib/ensureGlobalDocumentTypes';

/** Vercel: Hintergrund-Indexierung/KI nach dem Upload kann länger laufen als das Standard-Limit. */
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.oasis.opendocument.text', // .odt
];

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'application/vnd.oasis.opendocument.text': '.odt',
  };
  return map[mimeType] ?? '.pdf';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

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

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string)?.trim();
    const type = (formData.get('type') as string)?.trim() || 'ELTERNBRIEF';
    const date = (formData.get('date') as string)?.trim();
    const status = (formData.get('status') as string)?.trim() || 'ENTWURF';
    const protectionClass = (formData.get('protectionClass') as string)?.trim() || '1';
    const reachScopeRaw = ((formData.get('reachScope') as string) ?? 'intern').trim().toLowerCase();
    const reachScope = reachScopeRaw === 'extern' ? 'extern' : 'intern';
    const gremium = (formData.get('gremium') as string)?.trim() || null;
    const responsibleUnit = (formData.get('responsibleUnit') as string)?.trim() || 'Schulleitung';
    const participationGroupsRaw = (formData.get('participationGroups') as string | null) ?? '[]';
    let participationGroups: string[] = [];
    try {
      const parsed = JSON.parse(participationGroupsRaw) as unknown;
      if (Array.isArray(parsed)) {
        participationGroups = parsed
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.trim())
          .filter(Boolean)
          .slice(0, 20);
      }
    } catch {
      participationGroups = [];
    }

    // Validierung
    if (!file || !(file instanceof File)) {
      return apiError(400, 'VALIDATION_ERROR', 'Keine gültige Datei übergeben.');
    }
    if (!title) {
      return apiError(400, 'VALIDATION_ERROR', 'Titel ist ein Pflichtfeld.');
    }
    if (!date) {
      return apiError(400, 'VALIDATION_ERROR', 'Datum ist ein Pflichtfeld.');
    }

    if (!(WORKFLOW_STATUS_ORDER as readonly string[]).includes(status)) {
      return apiError(400, 'VALIDATION_ERROR', 'Ungültiger Status.');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return apiError(
        400,
        'VALIDATION_ERROR',
        `Datei ist zu groß. Maximale Größe: ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
      );
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return apiError(400, 'VALIDATION_ERROR', 'Nur PDF- und Word-Dateien (.pdf, .doc, .docx, .odt) sind erlaubt.');
    }

    const ext = getExtension(mimeType);
    const safeName = sanitizeFilename(file.name);

    // Pfad-Traversal verhindern
    if (safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
      return apiError(400, 'VALIDATION_ERROR', 'Ungültiger Dateiname.');
    }

    const protectionId = Math.max(1, Math.min(3, parseInt(protectionClass, 10) || 1));
    const access = await resolveUserAccess(user.email, supabase);
    const createdById = access.appUserId;
    const schoolNumber = access.schoolNumber ?? '000000';

    // Dokumenten-Quota prüfen (parallel: Quota-Wert + aktuelle Anzahl)
    const [schoolQuotaRes, docCountRes] = await Promise.all([
      supabase
        .from('schools')
        .select('quota_max_documents')
        .eq('school_number', schoolNumber)
        .single(),
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('school_number', schoolNumber),
    ]);
    const quotaMaxDocs = (schoolQuotaRes.data as { quota_max_documents?: number | null } | null)?.quota_max_documents ?? null;
    const currentDocCount = docCountRes.count ?? 0;
    if (quotaMaxDocs !== null && currentDocCount >= quotaMaxDocs) {
      return apiError(
        429,
        'QUOTA_EXCEEDED',
        `Dokument-Quota erreicht (${currentDocCount} / ${quotaMaxDocs}). Bitte wenden Sie sich an Ihren Administrator.`
      );
    }

    const { data: typeOpt } = await supabase
      .from('school_document_type_options')
      .select('label')
      .eq('school_number', schoolNumber)
      .eq('code', type)
      .maybeSingle();
    const typeLabel = ((typeOpt as { label?: string } | null)?.label ?? '').trim() || type;
    const ensureTypes = await ensureGlobalDocumentTypeRows(supabase, [{ code: type, label: typeLabel }]);
    if (ensureTypes.error) {
      return apiError(500, 'INTERNAL_ERROR', ensureTypes.error);
    }

    // 1) Dokument anlegen
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        school_number: schoolNumber,
        title,
        document_type_code: type,
        created_at: date,
        created_by_id: createdById,
        responsible_person_id: createdById,
        responsible_unit: responsibleUnit,
        protection_class_id: protectionId,
        status,
        gremium,
        participation_groups: participationGroups,
        reach_scope: reachScope,
      })
      .select('id')
      .single();

    if (docError || !docData) {
      return apiError(500, 'INTERNAL_ERROR', docError?.message ?? 'Dokument konnte nicht angelegt werden.');
    }

    const documentId = docData.id as string;
    const fileId = crypto.randomUUID();
    const filePath = `${schoolNumber}/${documentId}/${fileId}${ext}`;

    // 2) Datei in Storage hochladen
    const buffer = await file.arrayBuffer();
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) {
      await supabase.from('documents').delete().eq('id', documentId).eq('school_number', schoolNumber);
      return apiError(500, 'STORAGE_ERROR', `Speicher-Fehler: ${storageError.message}`);
    }

    // 3) Version mit file_uri anlegen
    const { data: verData, error: verError } = await supabase
      .from('document_versions')
      .insert({
        school_number: schoolNumber,
        document_id: documentId,
        version_number: '1.0',
        created_by_id: createdById,
        comment: 'Erstfassung',
        file_uri: filePath,
        mime_type: mimeType,
        is_published: status === 'VEROEFFENTLICHT',
      })
      .select('id')
      .single();

    if (verError || !verData) {
      await supabase.storage.from('documents').remove([filePath]);
      await supabase.from('documents').delete().eq('id', documentId).eq('school_number', schoolNumber);
      return apiError(500, 'INTERNAL_ERROR', verError?.message ?? 'Dokumentversion konnte nicht angelegt werden.');
    }

    const versionId = verData.id as string;

    // 4) current_version_id im Dokument setzen
    const { error: updateDocError } = await supabase
      .from('documents')
      .update({ current_version_id: versionId })
      .eq('id', documentId)
      .eq('school_number', schoolNumber);

    if (updateDocError) {
      return apiError(500, 'INTERNAL_ERROR', updateDocError.message ?? 'current_version_id konnte nicht gesetzt werden.');
    }

    // 5) Indexierung + KI-Zusammenfassung fire-and-forget — Antwort wird sofort gesendet,
    //    Extraktion und LLM-Aufruf laufen im Hintergrund. Buffer ist bereits im Speicher.
    const indexBuffer = Buffer.from(buffer);
    void (async () => {
      try {
        const { extractTextFromBuffer } = await import('../../../lib/documentText');
        const extracted = await extractTextFromBuffer(indexBuffer, mimeType);
        const { keywords, searchText } = buildSearchIndex({
          title,
          documentType: type,
          gremium,
          responsibleUnit,
          reachScope,
          participationGroups,
          summary: null,
          legalReference: null,
          extractedText: extracted.text,
        });
        await supabase
          .from('documents')
          .update({ search_text: searchText, keywords, indexed_at: new Date().toISOString() })
          .eq('id', documentId)
          .eq('school_number', schoolNumber);

        // Automatische KI-Zusammenfassung, wenn LLM konfiguriert und Text vorhanden
        if (isLlmConfigured() && extracted.text && extracted.text.length > 100) {
          try {
            const MAX_SUMMARY_CHARS = 12_000;
            const basisText = extracted.text.length > MAX_SUMMARY_CHARS
              ? extracted.text.slice(0, MAX_SUMMARY_CHARS) + '…'
              : extracted.text;
            const aiSettings = await getAiSettingsForSchool(schoolNumber);
            const promptTemplate = await getSchoolPromptTemplate(schoolNumber, 'summary');
            const systemPrompt = [promptTemplate.system_locked, promptTemplate.system_editable]
              .filter(Boolean).join('\n\n').trim();
            const userPromptTemplate = [promptTemplate.user_locked, promptTemplate.user_editable]
              .filter(Boolean).join('\n\n').trim();
            const userPrompt = renderPromptTemplate(userPromptTemplate, {
              school_profile_block: '',
              document_title: title,
              document_text: `Titel: ${title} · Typ: ${type}\n\n${basisText}`,
            });
            const summary = await callLlm(systemPrompt, userPrompt, {
              timeoutMs: aiSettings.llm_timeout_ms,
              usage: { supabase, schoolNumber, useCase: 'summary', metadata: { document_id: documentId } },
            });
            if (summary) {
              await supabase
                .from('documents')
                .update({ summary, summary_updated_at: new Date().toISOString() })
                .eq('id', documentId)
                .eq('school_number', schoolNumber);
            }
          } catch {
            // KI-Zusammenfassung ist Best-Effort; kein Rollback nötig
          }
        }
      } catch {
        // Indexierung ist Best-Effort; kein Rollback nötig
      }
    })();

    return NextResponse.json({
      success: true,
      documentId,
      versionId,
      message: 'Dokument wurde erfolgreich hochgeladen.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler beim Upload.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
