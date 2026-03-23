import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { getDocumentText } from '../../../../lib/documentText';
import { callLlm, isLlmConfigured } from '../../../../lib/llmClient';
import {
  getSuggestedDocuments,
  getDocumentsByIds,
  extractKeywords,
  MAX_DOCS,
  type DocRow,
} from '../../../../lib/aiSearch';
import {
  buildPromptSnippetFromChunks,
  pickTopChunksForQuestion,
} from '../../../../lib/chunkingOnTheFly';

// MVP-Parameter für "Chunking on-the-fly".
// Ziel: lange Dokumente nicht nur am Anfang zu verwenden, sondern relevante Passagen über Chunks.
const MAX_TEXT_PER_DOC = 4500;
const CHUNK_CHARS = 2500;
const CHUNK_OVERLAP_CHARS = 300;
const MAX_CHUNKS_PER_DOC = 3;

export async function POST(req: NextRequest) {
  try {
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

    let docList: DocRow[] = [];
    if (documentIds && documentIds.length > 0) {
      docList = await getDocumentsByIds(documentIds);
    } else {
      docList = (await getSuggestedDocuments(trimmed)).slice(0, MAX_DOCS);
    }

    const sourceTexts: { id: string; title: string; snippet: string }[] = [];
    const keywords = extractKeywords(trimmed);

    for (const doc of docList) {
      const summaryText = (doc.summary ?? '').trim();
      let text = summaryText.length > 30 ? summaryText : null;
      if (!text) {
        text = await getDocumentText(doc.id);
      }
      if (!text) text = (doc.legal_reference as string)?.trim() ?? '';
      if (text && text.trim().length > 30) {
        const selectedChunks = pickTopChunksForQuestion(text, keywords, {
          chunkChars: CHUNK_CHARS,
          overlapChars: CHUNK_OVERLAP_CHARS,
          maxChunks: MAX_CHUNKS_PER_DOC,
        });
        const snippet = buildPromptSnippetFromChunks(selectedChunks, MAX_TEXT_PER_DOC);
        if (snippet.length > 30) {
          sourceTexts.push({ id: doc.id, title: doc.title, snippet });
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

    const answer = await callLlm(systemPrompt, userPrompt);

    const userId = '00000000-0000-0000-0000-000000000001';
    await supabase.from('ai_queries').insert({
      user_id: userId,
      question: trimmed,
      answer_excerpt: answer.slice(0, 500),
      used_document_ids: sourceTexts.map((s) => s.id),
      success: true,
    });

    return NextResponse.json({
      answer,
      sources: sourceTexts.map((s) => ({
        documentId: s.id,
        title: s.title,
        snippet: s.snippet.slice(0, 200) + (s.snippet.length > 200 ? '…' : ''),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
