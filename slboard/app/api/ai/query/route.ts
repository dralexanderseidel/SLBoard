import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { getDocumentText } from '../../../../lib/documentText';
import { callLlm, isLlmConfigured } from '../../../../lib/llmClient';
import {
  getSuggestedDocuments,
  getDocumentsByIds,
  extractKeywords,
  buildDocumentMetadataPromptSection,
  MAX_DOCS,
  type DocRow,
} from '../../../../lib/aiSearch';
import { resolveUserAccess } from '../../../../lib/documentAccess';
import {
  buildPromptSnippetFromChunks,
  pickBestEvidenceChunkForQuestion,
  pickTopChunksForQuestion,
} from '../../../../lib/chunkingOnTheFly';
import {
  appendAiQueryDebugLog,
  isAiQueryDebugEnabledEffective,
  type AiQueryDebugDocEntry,
} from '../../../../lib/aiQueryDebugLog';
import { getAiSettingsForSchool } from '../../../../lib/aiSettings';
import { getSchoolProfileText } from '../../../../lib/schoolProfile';
import { apiError } from '../../../../lib/apiError';
import { getSchoolPromptTemplate, renderPromptTemplate } from '../../../../lib/aiPromptTemplates';
import { checkAiQuota } from '../../../../lib/quotaCheck';

export const runtime = 'nodejs';

// Defaults; werden pro Schule über public.ai_settings überschrieben.
const DEFAULT_MAX_TEXT_PER_DOC = 4500;
const DEFAULT_CHUNK_CHARS = 2500;
const DEFAULT_CHUNK_OVERLAP_CHARS = 300;
const DEFAULT_MAX_CHUNKS_PER_DOC = 3;

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const body = (await req.json()) as { question?: string; documentIds?: string[] };
    const trimmed = typeof body.question === 'string' ? body.question.trim() : '';
    const documentIds = Array.isArray(body.documentIds)
      ? body.documentIds.filter((id) => typeof id === 'string' && id)
      : undefined;

    if (!trimmed) {
      return apiError(400, 'VALIDATION_ERROR', 'Bitte geben Sie eine Frage ein.');
    }

    if (!isLlmConfigured()) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'LLM-Konfiguration fehlt.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    const access = await resolveUserAccess(user.email, supabase);

    // KI-Quota prüfen (parallel zu anderen Initialisierungen)
    const [quotaError, aiSettings, schoolProfile] = await Promise.all([
      checkAiQuota(supabase, access.schoolNumber),
      getAiSettingsForSchool(access.schoolNumber),
      getSchoolProfileText(access.schoolNumber),
    ]);
    if (quotaError) {
      return apiError(429, quotaError.code, quotaError.message);
    }
    const MAX_TEXT_PER_DOC = aiSettings.max_text_per_doc ?? DEFAULT_MAX_TEXT_PER_DOC;
    const CHUNK_CHARS = aiSettings.chunk_chars ?? DEFAULT_CHUNK_CHARS;
    const CHUNK_OVERLAP_CHARS = aiSettings.chunk_overlap_chars ?? DEFAULT_CHUNK_OVERLAP_CHARS;
    const MAX_CHUNKS_PER_DOC = aiSettings.max_chunks_per_doc ?? DEFAULT_MAX_CHUNKS_PER_DOC;
    const debugEnabled = isAiQueryDebugEnabledEffective(aiSettings.debug_log_enabled);

    let docList: DocRow[] = [];
    if (documentIds && documentIds.length > 0) {
      docList = await getDocumentsByIds(documentIds, access);
    } else {
      docList = (await getSuggestedDocuments(trimmed, access)).slice(0, MAX_DOCS);
    }

    const sourceTexts: {
      id: string;
      title: string;
      metadataBlock: string;
      promptSnippet: string;
      evidenceSnippet: string;
    }[] = [];
    const keywords = extractKeywords(trimmed);
    const debugDocEntries: AiQueryDebugDocEntry[] = [];

    const chunkParams = {
      chunkChars: CHUNK_CHARS,
      overlapChars: CHUNK_OVERLAP_CHARS,
      maxChunks: MAX_CHUNKS_PER_DOC,
    };

    // Alle Dokument-Texte parallel laden (statt sequentiell im Loop)
    const docTextMap = new Map<string, string>(
      await Promise.all(
        docList.map(async (doc) => [doc.id, ((await getDocumentText(doc.id)) ?? '').trim()] as const)
      )
    );

    for (const doc of docList) {
      const metadataBlock = buildDocumentMetadataPromptSection(doc as DocRow);

      // Antwortqualität: zuerst Volltext chunken; KI-Zusammenfassung nur bei fehlendem/kurzem Extrakt.
      const fullText = docTextMap.get(doc.id) ?? '';
      const summaryText = (doc.summary ?? '').trim();
      const legalText = ((doc.legal_reference as string) ?? '').trim();

      let text: string | null = null;
      if (fullText.length > 30) {
        text = fullText;
      } else if (summaryText.length > 30) {
        text = summaryText;
      } else if (legalText.length > 0) {
        text = legalText;
      }

      let promptSnippet = '';
      let evidenceSnippet = '';
      let selectedChunksForDebug: string[] = [];
      let builtSnippetLengthDebug = 0;

      if (text && text.trim().length > 30) {
        const selectedChunks = pickTopChunksForQuestion(text, keywords, chunkParams);
        const built = buildPromptSnippetFromChunks(selectedChunks, MAX_TEXT_PER_DOC);
        if (built.length > 30) {
          promptSnippet = built;
          // Textbeleg: Chunk mit höchstem Keyword-Score (nicht nur erster Chunk in Lesereihenfolge).
          const bestForEvidence =
            pickBestEvidenceChunkForQuestion(text, keywords, chunkParams) ?? selectedChunks[0] ?? '';
          const compact = bestForEvidence.replace(/\s+/g, ' ').trim();
          evidenceSnippet = compact.length > 360 ? `${compact.slice(0, 360)}…` : compact;
          selectedChunksForDebug = selectedChunks;
          builtSnippetLengthDebug = built.length;
        }
      }

      if (promptSnippet.length <= 30) {
        const fallback =
          summaryText.length > 30 ? summaryText : legalText.length > 0 ? legalText : '';
        if (fallback.length > 20) {
          promptSnippet = fallback.slice(0, MAX_TEXT_PER_DOC);
          evidenceSnippet = fallback.length > 360 ? `${fallback.slice(0, 360)}…` : fallback;
        } else {
          promptSnippet =
            '(Kein längerer Dokumententext extrahiert. Beantworte die Frage soweit möglich mit den Metadaten oben und allgemeinem Wissen.)';
          evidenceSnippet = '—';
        }
      }

      sourceTexts.push({
        id: doc.id,
        title: doc.title,
        metadataBlock,
        promptSnippet,
        evidenceSnippet,
      });
      if (debugEnabled && selectedChunksForDebug.length > 0) {
        debugDocEntries.push({
          documentId: doc.id,
          title: doc.title,
          chunkParams,
          selectedChunks: selectedChunksForDebug,
          builtSnippetLength: builtSnippetLengthDebug,
        });
      }
    }

    const contextBlock =
      sourceTexts.length > 0
        ? sourceTexts
            .map(
              (s) =>
                `--- ${s.title} ---\n${s.metadataBlock}\n\nDokumentinhalt (Auszug):\n${s.promptSnippet}`,
            )
            .join('\n\n')
        : 'Es wurden keine passenden Dokumente gefunden.';

    const promptTemplate = await getSchoolPromptTemplate(access.schoolNumber ?? '000000', 'qa');
    const systemPrompt = [promptTemplate.system_locked, promptTemplate.system_editable].filter(Boolean).join('\n\n').trim();
    const schoolContextBlock = schoolProfile ? `Schul-Steckbrief:\n${schoolProfile}\n\n` : '';
    const userPromptTemplate = [promptTemplate.user_locked, promptTemplate.user_editable].filter(Boolean).join('\n\n').trim();
    const userPrompt = renderPromptTemplate(userPromptTemplate, {
      question: trimmed,
      school_profile_block: schoolContextBlock,
      context: contextBlock,
    });

    if (debugEnabled) {
      void appendAiQueryDebugLog({
        timestamp: new Date().toISOString(),
        question: trimmed,
        schoolNumber: access.schoolNumber,
        keywords,
        documentSelection: documentIds && documentIds.length > 0 ? 'explicit_ids' : 'suggested',
        explicitDocumentIds: documentIds,
        documents: debugDocEntries,
        promptTemplateVersion: promptTemplate.version,
        systemPrompt,
        userPrompt,
      }, aiSettings.debug_log_enabled);
    }

    const answer = await callLlm(systemPrompt, userPrompt, {
      timeoutMs: aiSettings.llm_timeout_ms,
      usage: {
        supabase,
        schoolNumber: access.schoolNumber,
        useCase: 'qa',
      },
    });

    const sourcesPayload = sourceTexts.map((s) => ({
      documentId: s.id,
      title: s.title,
      snippet: s.evidenceSnippet,
    }));

    await supabase.from('ai_queries').insert({
      user_id: access.appUserId,
      school_number: access.schoolNumber ?? null,
      question: trimmed,
      answer_excerpt: answer.slice(0, 500),
      answer_text: answer,
      sources: sourcesPayload,
      used_document_ids: sourceTexts.map((s) => s.id),
      success: true,
    });

    return NextResponse.json({
      answer,
      sources: sourcesPayload,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
