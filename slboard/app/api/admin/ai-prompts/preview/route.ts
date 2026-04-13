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
import { buildDocumentMetadataPromptSection } from '../../../../../lib/aiSearch';

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
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Antwort ist kein gueltiges JSON-Objekt.'] };
  }
  const o = raw as Record<string, unknown>;
  const expectObject = (key: string): Record<string, unknown> | null => {
    const v = o[key];
    if (!v || typeof v !== 'object') {
      errors.push(`Feld "${key}" fehlt oder ist kein Objekt.`);
      return null;
    }
    return v as Record<string, unknown>;
  };
  const checkEnum = (obj: Record<string, unknown> | null, key: string, allowed: string[]) => {
    if (!obj) return;
    const val = obj.score;
    if (typeof val !== 'string' || !allowed.includes(val)) {
      errors.push(`"${key}.score" ungueltig (erlaubt: ${allowed.join('|')}).`);
    }
    if (typeof obj.begruendung !== 'string' || !obj.begruendung.trim()) {
      errors.push(`"${key}.begruendung" fehlt oder ist leer.`);
    }
  };

  const t = expectObject('tragfaehigkeit');
  const b = expectObject('belastungsgrad');
  const e = expectObject('entscheidungsstruktur');
  const v = expectObject('verbindlichkeit');
  const p = expectObject('passung');
  const g = expectObject('gesamtbewertung');

  checkEnum(t, 'tragfaehigkeit', ['niedrig', 'mittel', 'hoch']);
  checkEnum(b, 'belastungsgrad', ['niedrig', 'mittel', 'hoch']);
  checkEnum(e, 'entscheidungsstruktur', ['niedrig', 'mittel', 'hoch']);
  checkEnum(v, 'verbindlichkeit', ['niedrig', 'mittel', 'hoch']);
  checkEnum(p, 'passung', ['gut', 'kritisch']);
  checkEnum(g, 'gesamtbewertung', [
    'niedriger Steuerungsbedarf',
    'mittlerer Steuerungsbedarf',
    'hoher Steuerungsbedarf',
  ]);

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
    const useCase: PromptUseCase = body.use_case === 'qa' || body.use_case === 'summary' ? body.use_case : 'steering';
    const mode = body.mode === 'prompt_only' ? 'prompt_only' : 'llm_test';
    const access = await resolveUserAccess(user.email, supabase);
    const schoolNumber = access.schoolNumber ?? '000000';
    const template = await getSchoolPromptTemplate(schoolNumber, useCase);
    const systemPrompt = [template.system_locked, template.system_editable].filter(Boolean).join('\n\n').trim();

    const userTemplate = [template.user_locked, template.user_editable].filter(Boolean).join('\n\n').trim();
    const sampleMetadataBlock = buildDocumentMetadataPromptSection({
      id: '00000000-0000-0000-0000-000000000001',
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
    });
    const userPrompt = renderPromptTemplate(userTemplate, {
      question: 'Welche Fristen gelten fuer die Zeugnisabgabe?',
      context: 'Dokumentpassage A: Zeugnisabgabe bis 20.06. durch Klassenleitungen.',
      school_profile_block: 'Schul-Steckbrief:\nMittelgrosse Gesamtschule.\n\n',
      document_title: 'Testdokument',
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
    return NextResponse.json({
      use_case: useCase,
      mode,
      systemPrompt,
      userPrompt,
      outputPreview: raw.slice(0, 2000),
      steeringFormatOk: steeringValidation?.ok ?? null,
      steeringFormatErrors: steeringValidation?.errors ?? [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
