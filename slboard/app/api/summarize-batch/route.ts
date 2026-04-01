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

type SummarizeBatchPayload = {
  documentIds: string[];
};

const systemPrompt = 'Du bist ein deutscher Assistent für schulische Verwaltungsdokumente.';

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const { documentIds }: SummarizeBatchPayload = await req.json();

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return apiError(400, 'VALIDATION_ERROR', 'Keine documentIds übergeben.');
    }

    if (!isLlmConfigured()) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'LLM-Konfiguration fehlt.');
    }

    const supabase = supabaseServer();
    const access = await getUserAccessContext(user.email, supabase);
    const aiSettings = await getAiSettingsForSchool(access.schoolNumber);
    const debugEnabled = isAiQueryDebugEnabledEffective(aiSettings.debug_log_enabled);

    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    const uniqueIds = Array.from(new Set(documentIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));

    const MAX_SUMMARY_CHARS = 12000;

    const results: Array<{ documentId: string; ok: boolean; error?: string }> = [];
    let okCount = 0;

    for (const documentId of uniqueIds) {
      try {
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .select('id, title, document_type_code, created_at, school_number')
          .eq('id', documentId)
          .single();

        if (docError || !doc) throw new Error('Dokument nicht gefunden.');
        const docSchool = (doc as { school_number?: string | null }).school_number ?? null;
        if (!canAccessSchool(access, docSchool)) {
          throw new Error('Keine Berechtigung für dieses Dokument.');
        }

        const extractedText = await getDocumentText(documentId);
        let basisText = extractedText && extractedText.length > 50 ? extractedText : '';

        if (basisText.length > MAX_SUMMARY_CHARS) {
          basisText = basisText.slice(0, MAX_SUMMARY_CHARS) + '…';
        }

        if (!doc.title && !basisText) {
          throw new Error('Nicht ausreichend Inhalte für eine Zusammenfassung.');
        }

        const header = [
          doc.title ? `Titel: ${doc.title}` : null,
          doc.document_type_code ? `Typ: ${doc.document_type_code}` : null,
          doc.created_at ? `Datum: ${doc.created_at}` : null,
        ]
          .filter(Boolean)
          .join(' · ');

        const fullContent = `${header}\n\n${basisText}`.trim();
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
            'summarize-batch-item',
            {
              schoolNumber: access.schoolNumber,
              documentId,
              title: doc.title ?? null,
              type: doc.document_type_code ?? null,
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

        let updateQuery = supabase
          .from('documents')
          .update({ summary: summaryText, summary_updated_at: new Date().toISOString() })
          .eq('id', documentId);
        if (docSchool) updateQuery = updateQuery.eq('school_number', docSchool);
        await updateQuery;

        okCount += 1;
        results.push({ documentId, ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unbekannter Fehler beim Summarize.';
        if (debugEnabled) {
          void appendAiDebugEvent(
            'summarize-batch-item-error',
            {
              schoolNumber: access.schoolNumber,
              documentId,
              error: message,
            },
            aiSettings.debug_log_enabled
          );
        }
        results.push({ documentId, ok: false, error: message });
      }
    }

    const failCount = uniqueIds.length - okCount;
    return NextResponse.json({ okCount, failCount, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler in /api/summarize-batch';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}

