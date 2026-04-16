import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { getDocumentText } from '../../../../../lib/documentText';
import { callLlm, isLlmConfigured } from '../../../../../lib/llmClient';
import { resolveUserAccess } from '../../../../../lib/documentAccess';
import { extractKeywords, getDocumentsByIds, getSuggestedDocuments } from '../../../../../lib/aiSearch';
import {
  buildPromptSnippetFromChunks,
  pickTopChunksForQuestion,
} from '../../../../../lib/chunkingOnTheFly';
import { getAiSettingsForSchool } from '../../../../../lib/aiSettings';
import { getSchoolProfileText } from '../../../../../lib/schoolProfile';
import { appendAiDebugEvent, isAiQueryDebugEnabledEffective } from '../../../../../lib/aiQueryDebugLog';
import { apiError } from '../../../../../lib/apiError';
import { getDraftDocTypeConfig } from '../../../../../lib/draftDocTypes';

type Payload = {
  topic?: string;
  targetAudience?: string;
  purpose?: string;
  documentType?: string;
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
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const { topic, targetAudience, purpose, documentType, sourceIds }: Payload = await req.json();

    if (!topic?.trim()) {
      return apiError(400, 'VALIDATION_ERROR', 'Thema/Betreff ist erforderlich.');
    }

    if (!isLlmConfigured()) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'LLM-Konfiguration fehlt.');
    }

    // Typ-Code normalisieren: jeder nicht-leere String ist gültig
    const typeCode = typeof documentType === 'string' && documentType.trim()
      ? documentType.trim().toUpperCase()
      : 'ELTERNBRIEF';

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    const access = await resolveUserAccess(user.email, supabase);

    // Hardcoded-Defaults (für bekannte Typen aus draftDocTypes.ts)
    const hardcodedConfig = getDraftDocTypeConfig(typeCode);

    // Schulspezifische Entwurfs-Konfiguration aus DB laden (parallel zu aiSettings)
    const [aiSettings, dbDocTypeRes] = await Promise.all([
      getAiSettingsForSchool(access.schoolNumber),
      supabase
        .from('school_document_type_options')
        .select('label, draft_audience, draft_tone, draft_format_hint')
        .eq('school_number', access.schoolNumber)
        .eq('code', typeCode)
        .maybeSingle(),
    ]);

    const dbDocType = dbDocTypeRes.data as {
      label?: string | null;
      draft_audience?: string | null;
      draft_tone?: string | null;
      draft_format_hint?: string | null;
    } | null;

    // DB-Werte überschreiben Hardcode-Defaults (Fallback: hardcoded → generic)
    const typeLabel          = dbDocType?.label              || hardcodedConfig.label;
    const typeSystemRole     = hardcodedConfig.systemRole    || typeLabel;
    const typeTone           = dbDocType?.draft_tone         || hardcodedConfig.tone;
    const typeDefaultAudience = dbDocType?.draft_audience    || hardcodedConfig.defaultAudience;
    const typeFormatHint     = dbDocType?.draft_format_hint  || hardcodedConfig.formatInstructions;
    const schoolProfile = await getSchoolProfileText(access.schoolNumber);
    const debugEnabled = isAiQueryDebugEnabledEffective(aiSettings.debug_log_enabled);

    let docsToUse: { id: string; title: string; summary?: string | null }[] = [];

    if (sourceIds && sourceIds.length > 0) {
      const rows = await getDocumentsByIds(sourceIds, access);
      docsToUse = rows.map((d) => ({ id: d.id, title: d.title, summary: d.summary ?? null }));
    }

    // Wenn keine Quellen manuell gewählt: passende Vorlagen des gleichen Typs suchen
    if (docsToUse.length === 0) {
      const hint = `${topic ?? ''} ${targetAudience ?? ''} ${purpose ?? ''}`.trim();
      const rows = await getSuggestedDocuments(hint || ' ', access, {
        maxResults: 5,
        documentTypeCode: typeCode,
      });
      docsToUse = rows.map((d) => ({ id: d.id, title: d.title, summary: d.summary ?? null }));
    }

    const sourceTexts: { id: string; title: string; text: string }[] = [];
    const keywords = extractKeywords(`${topic ?? ''} ${targetAudience ?? ''} ${purpose ?? ''}`);

    const chunkParams = {
      chunkChars: Math.max(500, Math.floor(aiSettings.chunk_chars ?? TEMPLATE_CHUNK_CHARS)),
      overlapChars: Math.max(0, Math.floor(aiSettings.chunk_overlap_chars ?? TEMPLATE_CHUNK_OVERLAP)),
      maxChunks: Math.max(1, Math.floor(aiSettings.max_chunks_per_doc ?? TEMPLATE_MAX_CHUNKS)),
    };

    // Alle Dokument-Texte parallel laden
    const docTextMap = new Map<string, string>(
      await Promise.all(
        docsToUse.map(async (doc) => [doc.id, ((await getDocumentText(doc.id)) ?? '').trim()] as const)
      )
    );

    for (const doc of docsToUse) {
      const fullText = docTextMap.get(doc.id) ?? '';
      const summary = (doc.summary ?? '').trim();

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
        : `Es stehen keine Vorlagen zur Verfügung. Erstelle einen allgemeinen Entwurf.`;

    const systemPrompt = `Du bist ein deutscher Assistent für schulische ${typeSystemRole}.
Erstelle Entwürfe in ${typeTone} Ton, auf Deutsch.
Antworte NUR mit dem geforderten Format, ohne zusätzliche Erklärungen.`;

    const schoolContextBlock = schoolProfile ? `Schul-Steckbrief:\n${schoolProfile}\n\n` : '';
    const audienceValue = targetAudience?.trim() || typeDefaultAudience;

    const userPrompt = `Erstelle einen Entwurf für: ${typeLabel}

Thema/Betreff: ${topic}
Zielgruppe: ${audienceValue}
Zweck/Kontext: ${purpose || 'Information'}

${schoolContextBlock}Nutze folgende Vorlagen als Inspiration (Stil, Formulierungen):

${vorlagenBlock}

${typeFormatHint}

Antworte ausschließlich in diesem Format (keine anderen Zeichen davor oder danach):

BETREFF:
[Dein Vorschlag für den Betreff, eine Zeile]

TEXT:
[Dein Vorschlag für den Entwurfstext]`;

    if (debugEnabled) {
      void appendAiDebugEvent(
        'ai/drafts/document',
        {
          schoolNumber: access.schoolNumber,
          documentType: typeCode,
          topic: topic ?? '',
          targetAudience: audienceValue,
          typeLabel,
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

    const rawResponse = await callLlm(systemPrompt, userPrompt, {
      timeoutMs: aiSettings.llm_timeout_ms,
      usage: {
        supabase,
        schoolNumber: access.schoolNumber,
        useCase: 'draft',
        metadata: { document_type: typeCode, source_ids: docsToUse.map((d) => d.id) },
      },
    });

    let suggestedTitle = topic;
    let body = rawResponse;

    const betrefMatch = rawResponse.match(/BETREFF:\s*\n([^\n]+)/i);
    const textMatch = rawResponse.match(/TEXT:\s*\n([\s\S]+?)(?=\n\n[A-Z]+:|$)/i);

    if (betrefMatch) suggestedTitle = betrefMatch[1].trim();
    if (textMatch) body = textMatch[1].trim();

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
      disclaimer: 'Entwurf zur Prüfung – nicht automatisch versenden.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
