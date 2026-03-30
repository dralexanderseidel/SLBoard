import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { getDocumentText } from '../../../../../lib/documentText';
import { callLlm, isLlmConfigured } from '../../../../../lib/llmClient';
import { getUserAccessContext } from '../../../../../lib/documentAccess';
import { extractKeywords } from '../../../../../lib/aiSearch';
import {
  buildPromptSnippetFromChunks,
  pickTopChunksForQuestion,
} from '../../../../../lib/chunkingOnTheFly';
import { getAiSettingsForSchool } from '../../../../../lib/aiSettings';
import { getSchoolProfileText } from '../../../../../lib/schoolProfile';
import { appendAiDebugEvent, isAiQueryDebugEnabledEffective } from '../../../../../lib/aiQueryDebugLog';

type Payload = {
  topic?: string;
  targetAudience?: string;
  purpose?: string;
  sourceIds?: string[];
};

const TEMPLATE_MAX_CHARS = 3800;
const TEMPLATE_CHUNK_CHARS = 2400;
const TEMPLATE_CHUNK_OVERLAP = 250;
const TEMPLATE_MAX_CHUNKS = 3;
const SUMMARY_CONTEXT_CHARS = 700;

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    const { topic, targetAudience, purpose, sourceIds }: Payload = await req.json();

    if (!topic?.trim()) {
      return NextResponse.json(
        { error: 'Thema/Betreff ist erforderlich.' },
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
    const aiSettings = await getAiSettingsForSchool(access.schoolNumber);
    const schoolProfile = await getSchoolProfileText(access.schoolNumber);
    const debugEnabled = isAiQueryDebugEnabledEffective(aiSettings.debug_log_enabled);

    let docsToUse: { id: string; title: string; summary?: string | null }[] = [];

    if (sourceIds && sourceIds.length > 0) {
      let selectedDocsQuery = supabase
        .from('documents')
        .select('id, title, summary')
        .in('id', sourceIds);
      if (access.schoolNumber) selectedDocsQuery = selectedDocsQuery.eq('school_number', access.schoolNumber);
      const { data } = await selectedDocsQuery;
      docsToUse = (data ?? []).map((d) => ({ id: d.id, title: d.title, summary: (d as any).summary ?? null }));
    }

    if (docsToUse.length === 0) {
      let fallbackDocsQuery = supabase
        .from('documents')
        .select('id, title, summary')
        .eq('document_type_code', 'ELTERNBRIEF')
        .in('status', ['FREIGEGEBEN', 'VEROEFFENTLICHT'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (access.schoolNumber) fallbackDocsQuery = fallbackDocsQuery.eq('school_number', access.schoolNumber);
      const { data } = await fallbackDocsQuery;
      docsToUse = (data ?? []).map((d) => ({ id: d.id, title: d.title, summary: (d as any).summary ?? null }));
    }

    const sourceTexts: { id: string; title: string; text: string }[] = [];
    const keywords = extractKeywords(`${topic ?? ''} ${targetAudience ?? ''} ${purpose ?? ''}`);

    const chunkParams = {
      chunkChars: Math.max(500, Math.floor(aiSettings.chunk_chars ?? TEMPLATE_CHUNK_CHARS)),
      overlapChars: Math.max(0, Math.floor(aiSettings.chunk_overlap_chars ?? TEMPLATE_CHUNK_OVERLAP)),
      maxChunks: Math.max(1, Math.floor(aiSettings.max_chunks_per_doc ?? TEMPLATE_MAX_CHUNKS)),
    };
    for (const doc of docsToUse) {
      const fullText = ((await getDocumentText(doc.id)) ?? '').trim();
      const summary = (doc.summary ?? '').trim();

      // Optional schneller Kontext über Summary; Hauptsubstanz kommt aus relevanten Volltext-Passagen.
      const summaryBlock =
        summary.length > 30
          ? `Zusammenfassung:\n${summary.slice(0, SUMMARY_CONTEXT_CHARS)}${summary.length > SUMMARY_CONTEXT_CHARS ? '…' : ''}\n\n`
          : '';

      let mainBlock = '';
      if (fullText.length > 50) {
        const selectedChunks = pickTopChunksForQuestion(fullText, keywords, chunkParams);
        mainBlock = buildPromptSnippetFromChunks(selectedChunks, TEMPLATE_MAX_CHARS).trim();
      } else if (summary.length > 50) {
        mainBlock = summary.slice(0, TEMPLATE_MAX_CHARS).trim();
      }

      const combined = `${summaryBlock}${mainBlock}`.trim();
      if (combined.length > 50) {
        sourceTexts.push({ id: doc.id, title: doc.title, text: combined });
      }
    }

    const vorlagenBlock =
      sourceTexts.length > 0
        ? sourceTexts
            .map(
              (s) =>
                `--- Vorlage: ${s.title} ---\n${s.text.slice(0, TEMPLATE_MAX_CHARS)}${s.text.length > TEMPLATE_MAX_CHARS ? '…' : ''}`,
            )
            .join('\n\n')
        : 'Es stehen keine Vorlagen zur Verfügung. Erstelle einen allgemeinen Entwurf.';

    const systemPrompt = `Du bist ein deutscher Assistent für schulische Verwaltungsdokumente.
Erstelle Entwürfe für Elternbriefe in sachlichem, freundlichem Ton.
Antworte NUR mit dem geforderten Format, ohne zusätzliche Erklärungen.`;

    const schoolContextBlock = schoolProfile ? `Schul-Steckbrief:\n${schoolProfile}\n\n` : '';

    const userPrompt = `Erstelle einen Entwurf für einen Elternbrief.

Thema/Betreff: ${topic}
Zielgruppe: ${targetAudience || 'Eltern'}
Zweck/Kontext: ${purpose || 'Information'}

${schoolContextBlock}Nutze folgende Vorlagen als Inspiration (Stil, Formulierungen):

${vorlagenBlock}

Antworte ausschließlich in diesem Format (keine anderen Zeichen davor oder danach):

BETREFF:
[Dein Vorschlag für den Betreff, eine Zeile]

TEXT:
[Dein Vorschlag für den Entwurfstext, mit Anrede und Grußformel]`;

    if (debugEnabled) {
      void appendAiDebugEvent(
        'ai/drafts/parent-letter',
        {
          schoolNumber: access.schoolNumber,
          topic: topic ?? '',
          targetAudience: targetAudience ?? '',
          purpose: purpose ?? '',
          sourceCount: sourceTexts.length,
          sourceIds: docsToUse.map((d) => d.id),
          chunkParams,
          keywords,
          systemPrompt,
          userPrompt,
        },
        aiSettings.debug_log_enabled
      );
    }

    const rawResponse = await callLlm(systemPrompt, userPrompt);

    let suggestedTitle = topic;
    let body = rawResponse;

    const betrefMatch = rawResponse.match(/BETREFF:\s*\n([^\n]+)/i);
    const textMatch = rawResponse.match(/TEXT:\s*\n([\s\S]+?)(?=\n\n[A-Z]+:|$)/i);

    if (betrefMatch) suggestedTitle = betrefMatch[1].trim();
    if (textMatch) body = textMatch[1].trim();

    // Robustheit: Wenn die KI das Format nicht einhält, liefern wir trotzdem einen brauchbaren Text.
    // - Betreff: Fallback bleibt das Thema.
    // - Text: Falls nichts gefunden wurde, verwenden wir die Rohantwort (ohne leere Ausgabe).
    const normalizedBody = (body ?? '').trim();
    if (!textMatch && normalizedBody.length > 0) {
      body = normalizedBody
        .replace(/^\s*BETREFF:\s*\n[^\n]*\n+/i, '')
        .replace(/^\s*TEXT:\s*\n/i, '')
        .trim();
    }
    if (!body || body.trim().length === 0) {
      body = rawResponse.trim() || topic.trim();
    }

    return NextResponse.json({
      suggestedTitle,
      body,
      sources: docsToUse.map((d) => ({ documentId: d.id, title: d.title })),
      disclaimer: 'Entwurf zur Prüfung. Nicht automatisch versenden.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
