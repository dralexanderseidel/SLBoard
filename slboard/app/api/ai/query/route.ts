import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { getDocumentText } from '../../../../lib/documentText';
import { callLlm, isLlmConfigured } from '../../../../lib/llmClient';
import {
  getSuggestedDocuments,
  getDocumentsByIds,
  extractKeywords,
  MAX_DOCS,
  type DocRow,
} from '../../../../lib/aiSearch';
import { getUserAccessContext } from '../../../../lib/documentAccess';
import {
  buildPromptSnippetFromChunks,
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

    const access = await getUserAccessContext(user.email, supabase);
    const aiSettings = await getAiSettingsForSchool(access.schoolNumber);
    const schoolProfile = await getSchoolProfileText(access.schoolNumber);
    const MAX_TEXT_PER_DOC = aiSettings.max_text_per_doc ?? DEFAULT_MAX_TEXT_PER_DOC;
    const CHUNK_CHARS = aiSettings.chunk_chars ?? DEFAULT_CHUNK_CHARS;
    const CHUNK_OVERLAP_CHARS = aiSettings.chunk_overlap_chars ?? DEFAULT_CHUNK_OVERLAP_CHARS;
    const MAX_CHUNKS_PER_DOC = aiSettings.max_chunks_per_doc ?? DEFAULT_MAX_CHUNKS_PER_DOC;
    const debugEnabled = isAiQueryDebugEnabledEffective(aiSettings.debug_log_enabled);

    let docList: DocRow[] = [];
    if (documentIds && documentIds.length > 0) {
      docList = await getDocumentsByIds(documentIds, access.schoolNumber);
    } else {
      docList = (await getSuggestedDocuments(trimmed, access.schoolNumber)).slice(0, MAX_DOCS);
    }

    const sourceTexts: {
      id: string;
      title: string;
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

    for (const doc of docList) {
      // Antwortqualität: zuerst Volltext chunken; KI-Zusammenfassung nur bei fehlendem/kurzem Extrakt.
      const fullText = ((await getDocumentText(doc.id)) ?? '').trim();
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

      if (text && text.trim().length > 30) {
        const selectedChunks = pickTopChunksForQuestion(text, keywords, chunkParams);
        const promptSnippet = buildPromptSnippetFromChunks(selectedChunks, MAX_TEXT_PER_DOC);
        if (promptSnippet.length > 30) {
          const firstChunk = (selectedChunks[0] ?? '').replace(/\s+/g, ' ').trim();
          const evidenceSnippet =
            firstChunk.length > 360 ? `${firstChunk.slice(0, 360)}…` : firstChunk;
          sourceTexts.push({
            id: doc.id,
            title: doc.title,
            promptSnippet,
            evidenceSnippet,
          });
          if (debugEnabled) {
            debugDocEntries.push({
              documentId: doc.id,
              title: doc.title,
              chunkParams,
              selectedChunks,
              builtSnippetLength: promptSnippet.length,
            });
          }
        }
      }
    }

    const contextBlock =
      sourceTexts.length > 0
        ? sourceTexts
            .map((s) => `--- ${s.title} ---\n${s.promptSnippet}`)
            .join('\n\n')
        : 'Es wurden keine passenden Dokumente gefunden.';

    const systemPrompt = `Du bist ein deutscher Assistent für schulische Verwaltungsdokumente.
Beantworte die Nutzerfrage NUR auf Basis der bereitgestellten Dokumentpassagen.
Wenn die Dokumente die Frage nicht beantworten, sage das klar.
Zitiere keine Quellen wörtlich, fasse zusammen. Nenne am Ende die verwendeten Dokumenttitel.`;

    const schoolContextBlock = schoolProfile ? `Schul-Steckbrief:\n${schoolProfile}\n\n` : '';

    const userPrompt = `Frage des Nutzers: ${trimmed}

${schoolContextBlock}Dokumentpassagen:
${contextBlock}

Antworte in 3–6 Sätzen.`;

    if (debugEnabled) {
      void appendAiQueryDebugLog({
        timestamp: new Date().toISOString(),
        question: trimmed,
        schoolNumber: access.schoolNumber,
        keywords,
        documentSelection: documentIds && documentIds.length > 0 ? 'explicit_ids' : 'suggested',
        explicitDocumentIds: documentIds,
        documents: debugDocEntries,
        systemPrompt,
        userPrompt,
      }, aiSettings.debug_log_enabled);
    }

    const answer = await callLlm(systemPrompt, userPrompt, {
      timeoutMs: aiSettings.llm_timeout_ms,
    });

    const sourcesPayload = sourceTexts.map((s) => ({
      documentId: s.id,
      title: s.title,
      snippet: s.evidenceSnippet,
    }));

    const userId = '00000000-0000-0000-0000-000000000001';
    await supabase.from('ai_queries').insert({
      user_id: userId,
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
