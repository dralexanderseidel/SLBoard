import { NextRequest, NextResponse } from 'next/server';
import { callLlm, isLlmConfigured } from '../../../lib/llmClient';
import { supabaseServer } from '../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../lib/supabaseServerClient';
import { canAccessSchool, resolveUserAccess } from '../../../lib/documentAccess';
import { apiError } from '../../../lib/apiError';
import { getAiSettingsForSchool } from '../../../lib/aiSettings';
import { appendAiDebugEvent, isAiQueryDebugEnabledEffective } from '../../../lib/aiQueryDebugLog';
import { getSchoolPromptTemplate, renderPromptTemplate } from '../../../lib/aiPromptTemplates';
import { checkAiQuota } from '../../../lib/quotaCheck';
import { loadSchoolFeatureFlags, apiResponseIfAiDisabled } from '../../../lib/schoolFeatureFlags';

export const runtime = 'nodejs';

/** Vercel: Textextraktion + LLM überschreiten oft das 10s-Default-Limit. */
export const maxDuration = 60;

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
    const access = await resolveUserAccess(user.email, supabase);

    const schoolFeatures = await loadSchoolFeatureFlags(supabase, access.schoolNumber);
    const aiBlocked = apiResponseIfAiDisabled(schoolFeatures);
    if (aiBlocked) return aiBlocked;

    // KI-Quota prüfen
    const quotaError = await checkAiQuota(supabase, access.schoolNumber);
    if (quotaError) {
      return apiError(429, 'QUOTA_EXCEEDED', quotaError.message);
    }

    const aiSettings = await getAiSettingsForSchool(access.schoolNumber ?? null);
    const debugEnabled = isAiQueryDebugEnabledEffective(aiSettings.debug_log_enabled);

    let basisText = text ?? '';
    const MAX_SUMMARY_CHARS = 12000;

    // Bei Dokument mit Datei: zuerst Text aus PDF/Word extrahieren, Metadaten nur als Fallback
    if (documentId) {
      const { getDocumentText } = await import('../../../lib/documentText');
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

    const promptTemplate = await getSchoolPromptTemplate(access.schoolNumber ?? '000000', 'summary');
    const systemPrompt = [promptTemplate.system_locked, promptTemplate.system_editable].filter(Boolean).join('\n\n').trim();
    const userPromptTemplate = [promptTemplate.user_locked, promptTemplate.user_editable].filter(Boolean).join('\n\n').trim();
    const userPrompt = renderPromptTemplate(userPromptTemplate, {
      school_profile_block: '',
      document_title: title ?? 'Unbenanntes Dokument',
      document_text: fullContent,
    });

    const summary = await callLlm(systemPrompt, userPrompt, {
      timeoutMs: aiSettings.llm_timeout_ms,
      usage: {
        supabase,
        schoolNumber: access.schoolNumber,
        useCase: 'summary',
        metadata: documentId ? { document_id: documentId } : null,
      },
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
          promptTemplateVersion: promptTemplate.version,
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

