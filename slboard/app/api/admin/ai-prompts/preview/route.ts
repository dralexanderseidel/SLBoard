import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../../lib/adminAuth';
import { resolveUserAccess } from '../../../../../lib/documentAccess';
import {
  getSchoolPromptTemplate,
  renderPromptTemplate,
  type PromptUseCase,
} from '../../../../../lib/aiPromptTemplates';
import { callLlm, isLlmConfigured } from '../../../../../lib/llmClient';
import { getAiSettingsForSchool } from '../../../../../lib/aiSettings';
import { apiError } from '../../../../../lib/apiError';
import { loadSchoolFeatureFlags, apiResponseIfAiDisabled } from '../../../../../lib/schoolFeatureFlags';
import { buildDocumentMetadataPromptSection } from '../../../../../lib/aiSearch';
import { mapDbStatusToSteeringDocumentStatus, parseSteeringAnalysisV2 } from '../../../../../lib/steeringAnalysisV2';

export const runtime = 'nodejs';

type PreviewPayload = {
  use_case?: PromptUseCase;
  mode?: 'prompt_only' | 'llm_test';
};

function extractJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function validateSteeringShape(raw: unknown): { ok: boolean; errors: string[] } {
  const r = parseSteeringAnalysisV2(raw, '00000000-0000-0000-0000-000000000001');
  if (r.ok) return { ok: true, errors: [] };
  return { ok: false, errors: r.errors };
}

function validateTodosShape(raw: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Antwort ist kein gueltiges JSON-Objekt.'] };
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.aufgaben)) {
    errors.push('"aufgaben" fehlt oder ist kein Array.');
    return { ok: false, errors };
  }
  for (let i = 0; i < o.aufgaben.length; i++) {
    const item = o.aufgaben[i];
    if (!item || typeof item !== 'object') {
      errors.push(`aufgaben[${i}] ist kein Objekt.`);
      continue;
    }
    const it = item as Record<string, unknown>;
    if (typeof it.titel !== 'string' || !it.titel.trim()) {
      errors.push(`aufgaben[${i}].titel fehlt oder ist leer.`);
    }
    if (it.prioritaet !== undefined && it.prioritaet !== null) {
      const p = it.prioritaet;
      if (p !== 'niedrig' && p !== 'mittel' && p !== 'hoch') {
        errors.push(`aufgaben[${i}].prioritaet ungueltig (niedrig|mittel|hoch).`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');

    const supabase = supabaseServer();
    if (!supabase) return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const body = (await req.json().catch(() => ({}))) as PreviewPayload;
    const uc = body.use_case;
    const useCase: PromptUseCase =
      uc === 'qa' || uc === 'summary'
        ? uc
        : uc === 'todos'
          ? 'todos'
          : 'steering';
    const mode = body.mode === 'prompt_only' ? 'prompt_only' : 'llm_test';
    const access = await resolveUserAccess(user.email, supabase);
    const schoolNumber = access.schoolNumber ?? '000000';
    const template = await getSchoolPromptTemplate(schoolNumber, useCase);
    const systemPrompt = [template.system_locked, template.system_editable].filter(Boolean).join('\n\n').trim();

    const userTemplate = [template.user_locked, template.user_editable].filter(Boolean).join('\n\n').trim();
    const previewDocId = '00000000-0000-0000-0000-000000000001';
    const sampleMetadataBlock = buildDocumentMetadataPromptSection({
      id: previewDocId,
      title: 'Testdokument',
      document_type_code: 'PROTOKOLL',
      created_at: new Date().toISOString(),
      status: 'ENTWURF',
      legal_reference: 'Musterrecht',
      responsible_unit: 'Schulleitung',
      gremium: 'Schulkonferenz',
      reach_scope: 'intern',
      participation_groups: ['Lehrkräfte'],
      review_date: '2026-12-31',
      summary: 'Kurzbeschreibung fuer die Vorschau.',
      schulentwicklung_primary_field: 'qualitaetsentwicklung',
      schulentwicklung_fields: ['qualitaetsentwicklung', 'fuehrung_governance'],
    });
    const analysisDate = new Date().toISOString().slice(0, 10);
    const userPrompt = renderPromptTemplate(userTemplate, {
      question: 'Welche Fristen gelten fuer die Zeugnisabgabe?',
      context: 'Dokumentpassage A: Zeugnisabgabe bis 20.06. durch Klassenleitungen.',
      school_profile_block: 'Schul-Steckbrief:\nMittelgrosse Gesamtschule.\n\n',
      document_title: 'Testdokument',
      document_id: previewDocId,
      analysis_date: analysisDate,
      document_status_json: mapDbStatusToSteeringDocumentStatus('ENTWURF', null),
      document_metadata_block: sampleMetadataBlock,
      document_text:
        'Die Klassenleitungen melden Zeugnisdaten bis 20.06. Das Sekretariat prueft Vollstaendigkeit. Beschlusswege sind im Dokument nur teilweise konkretisiert.',
    });

    if (mode === 'prompt_only' || !isLlmConfigured()) {
      const promptPreview = `=== System Prompt ===\n${systemPrompt}\n\n=== User Prompt ===\n${userPrompt}`;
      return NextResponse.json({
        use_case: useCase,
        systemPrompt,
        userPrompt,
        outputPreview: promptPreview.slice(0, 12000),
        previewOnly: true,
        mode,
        steeringFormatOk: null,
        steeringFormatErrors: [],
        message:
          mode === 'prompt_only'
            ? 'Nur Prompt-Vorschau erzeugt (ohne LLM-Aufruf).'
            : 'LLM nicht konfiguriert: nur Prompt-Vorschau erzeugt.',
      });
    }

    const schoolFlags = await loadSchoolFeatureFlags(supabase, schoolNumber);
    const aiFeatureBlocked = apiResponseIfAiDisabled(schoolFlags);
    if (aiFeatureBlocked) return aiFeatureBlocked;

    const aiSettings = await getAiSettingsForSchool(schoolNumber);
    const raw = await callLlm(systemPrompt, userPrompt, {
      timeoutMs: aiSettings.llm_timeout_ms,
      usage: {
        supabase,
        schoolNumber,
        useCase: 'prompt_preview',
        metadata: { template_use_case: useCase },
      },
    });
    const parsed = extractJsonObject(raw);
    const steeringValidation = useCase === 'steering' ? validateSteeringShape(parsed) : null;
    const todosValidation = useCase === 'todos' ? validateTodosShape(parsed) : null;
    return NextResponse.json({
      use_case: useCase,
      mode,
      systemPrompt,
      userPrompt,
      outputPreview: raw.slice(0, 2000),
      steeringFormatOk: steeringValidation?.ok ?? null,
      steeringFormatErrors: steeringValidation?.errors ?? [],
      todosFormatOk: todosValidation?.ok ?? null,
      todosFormatErrors: todosValidation?.errors ?? [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
