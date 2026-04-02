import { NextRequest, NextResponse } from 'next/server';
import { getDocumentText } from '../../../lib/documentText';
import { callLlm, isLlmConfigured } from '../../../lib/llmClient';
import { supabaseServer } from '../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../lib/supabaseServerClient';
import { canAccessSchool, getUserAccessContext } from '../../../lib/documentAccess';
import { apiError } from '../../../lib/apiError';
import { getAiSettingsForSchool } from '../../../lib/aiSettings';
import { appendAiDebugEvent, isAiQueryDebugEnabledEffective } from '../../../lib/aiQueryDebugLog';

export const runtime = 'nodejs';

type SummarizePayload = {
  title?: string;
  type?: string;
  createdAt?: string;
  text?: string;
  documentId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const { title, type, createdAt, text, documentId }: SummarizePayload = await req.json();
    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }
    const access = await getUserAccessContext(user.email, supabase);
    const aiSettings = await getAiSettingsForSchool(access.schoolNumber ?? null);
    const debugEnabled = isAiQueryDebugEnabledEffective(aiSettings.debug_log_enabled);

    let basisText = text ?? '';
    const MAX_SUMMARY_CHARS = 12000;

    // Bei Dokument mit Datei: zuerst Text aus PDF/Word extrahieren, Metadaten nur als Fallback
    if (documentId) {
      const extractedText = await getDocumentText(documentId);
      if (extractedText && extractedText.length > 50) {
        basisText = extractedText;
      }
    }

    // Token-/Context-Schutz: sehr lange Dokumente dürfen das LLM nicht sprengen.
    if (basisText.length > MAX_SUMMARY_CHARS) {
      basisText = basisText.slice(0, MAX_SUMMARY_CHARS) + '…';
    }

    if (!title && !basisText) {
      return apiError(400, 'VALIDATION_ERROR', 'Es wurden keine ausreichenden Inhalte für eine Zusammenfassung übergeben.');
    }

    if (!isLlmConfigured()) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'LLM-Konfiguration fehlt.');
    }

    const header = [
      title ? `Titel: ${title}` : null,
      type ? `Typ: ${type}` : null,
      createdAt ? `Datum: ${createdAt}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const fullContent = `${header}\n\n${basisText}`.trim();

    const systemPrompt = 'Du bist ein deutscher Assistent für schulische Verwaltungsdokumente.';
    const userPrompt = `
Fasse den folgenden Inhalt in 4–7 klaren, gut lesbaren Sätzen zusammen.
Nenne wichtige Regelungen, Beschlüsse und Zuständigkeiten in neutraler Verwaltungssprache.

Inhalt:
${fullContent}
`.trim();

    const summary = await callLlm(systemPrompt, userPrompt, {
      timeoutMs: aiSettings.llm_timeout_ms,
    });
    const summaryText = summary || 'Keine Zusammenfassung vom LLM zurückgegeben.';

    if (debugEnabled) {
      void appendAiDebugEvent(
        'summarize',
        {
          schoolNumber: access?.schoolNumber ?? null,
          documentId: documentId ?? null,
          title: title ?? null,
          type: type ?? null,
          inputTextLength: basisText.length,
          fullContentLength: fullContent.length,
          timeoutMs: aiSettings.llm_timeout_ms,
          systemPrompt,
          userPrompt,
          summaryLength: summaryText.length,
          summaryPreview: summaryText.slice(0, 1200),
        },
        aiSettings.debug_log_enabled
      );
    }

    // Zusammenfassung in DB speichern, wenn documentId vorhanden
    if (documentId) {
      if (supabase) {
        const { data: doc } = await supabase
          .from('documents')
          .select('id, school_number')
          .eq('id', documentId)
          .single();
        const docSchool = (doc as { school_number?: string | null } | null)?.school_number ?? null;
        if (!canAccessSchool(access, docSchool)) {
          return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für dieses Dokument.');
        }
        let updateQuery = supabase
          .from('documents')
          .update({ summary: summaryText, summary_updated_at: new Date().toISOString() })
          .eq('id', documentId);
        if (docSchool) updateQuery = updateQuery.eq('school_number', docSchool);
        await updateQuery;
      }
    }

    return NextResponse.json({ summary: summaryText });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler in /api/summarize';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}

