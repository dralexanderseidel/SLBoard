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
  isAiQueryDebugEnabled,
  type AiQueryDebugDocEntry,
} from '../../../../lib/aiQueryDebugLog';

export const runtime = 'nodejs';

// MVP-Parameter für "Chunking on-the-fly".
// Ziel: lange Dokumente nicht nur am Anfang zu verwenden, sondern relevante Passagen über Chunks.
const MAX_TEXT_PER_DOC = 4500;
const CHUNK_CHARS = 2500;
const CHUNK_OVERLAP_CHARS = 300;
const MAX_CHUNKS_PER_DOC = 3;

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    const body = (await req.json()) as { question?: string; documentIds?: string[] };
    const trimmed = typeof body.question === 'string' ? body.question.trim() : '';
    const documentIds = Array.isArray(body.documentIds)
      ? body.documentIds.filter((id) => typeof id === 'string' && id)
      : undefined;

    if (!trimmed) {
      return NextResponse.json(
        { error: 'Bitte geben Sie eine Frage ein.' },
        { status: 400 },
      );
    }

    if (!isLlmConfigured()) {
      return NextResponse.json(
        { error: 'LLM-Umgebungsvariablen sind nicht gesetzt.' },
        { status: 500 },
      );
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase-Service nicht verfügbar.' },
        { status: 500 },
      );
    }

    const access = await getUserAccessContext(user.email, supabase);

    let docList: DocRow[] = [];
    if (documentIds && documentIds.length > 0) {
      docList = await getDocumentsByIds(documentIds, access.schoolNumber);
    } else {
      docList = (await getSuggestedDocuments(trimmed, access.schoolNumber)).slice(0, MAX_DOCS);
    }

    const sourceTexts: { id: string; title: string; snippet: string }[] = [];
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
        const snippet = buildPromptSnippetFromChunks(selectedChunks, MAX_TEXT_PER_DOC);
        if (snippet.length > 30) {
          sourceTexts.push({ id: doc.id, title: doc.title, snippet });
          if (isAiQueryDebugEnabled()) {
            debugDocEntries.push({
              documentId: doc.id,
              title: doc.title,
              chunkParams,
              selectedChunks,
              builtSnippetLength: snippet.length,
            });
          }
        }
      }
    }

    const contextBlock =
      sourceTexts.length > 0
        ? sourceTexts
            .map((s) => `--- ${s.title} ---\n${s.snippet}`)
            .join('\n\n')
        : 'Es wurden keine passenden Dokumente gefunden.';

    const systemPrompt = `Du bist ein deutscher Assistent für schulische Verwaltungsdokumente.
Beantworte die Nutzerfrage NUR auf Basis der bereitgestellten Dokumentpassagen.
Wenn die Dokumente die Frage nicht beantworten, sage das klar.
Zitiere keine Quellen wörtlich, fasse zusammen. Nenne am Ende die verwendeten Dokumenttitel.`;

    const userPrompt = `Frage des Nutzers: ${trimmed}

Dokumentpassagen:
${contextBlock}

Antworte in 3–6 Sätzen.`;

    if (isAiQueryDebugEnabled()) {
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
      });
    }

    const answer = await callLlm(systemPrompt, userPrompt);

    const sourcesPayload = sourceTexts.map((s) => ({
      documentId: s.id,
      title: s.title,
      snippet: s.snippet.slice(0, 200) + (s.snippet.length > 200 ? '…' : ''),
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
