import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../../../lib/documentAccess';
import { callLlm, isLlmConfigured } from '../../../../../lib/llmClient';
import { getSchoolProfileText } from '../../../../../lib/schoolProfile';
import { getAiSettingsForSchool } from '../../../../../lib/aiSettings';
import { appendAiDebugEvent, isAiQueryDebugEnabledEffective } from '../../../../../lib/aiQueryDebugLog';
import { apiError } from '../../../../../lib/apiError';
import { loadSchoolFeatureFlags, apiResponseIfAiDisabled } from '../../../../../lib/schoolFeatureFlags';
import { chunkTextByParagraphs } from '../../../../../lib/chunkingOnTheFly';
import { getSchoolPromptTemplate, renderPromptTemplate } from '../../../../../lib/aiPromptTemplates';
import { buildDocumentMetadataPromptSection, type DocRow } from '../../../../../lib/aiSearch';

export const runtime = 'nodejs';

type Prioritaet = 'niedrig' | 'mittel' | 'hoch';

type SteeringTodoItem = {
  titel: string;
  beschreibung?: string;
  prioritaet?: Prioritaet;
  verantwortlich_hint?: string;
  frist_hint?: string;
};

type SteeringTodosResult = {
  aufgaben: SteeringTodoItem[];
  hinweis?: string;
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

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isPrioritaet(v: unknown): v is Prioritaet {
  return v === 'niedrig' || v === 'mittel' || v === 'hoch';
}

function normalizeTodos(raw: unknown): SteeringTodosResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const arr = o.aufgaben;
  if (!Array.isArray(arr)) return null;
  const aufgaben: SteeringTodoItem[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const titel = asText(it.titel);
    if (!titel) continue;
    const entry: SteeringTodoItem = { titel };
    const b = asText(it.beschreibung);
    if (b) entry.beschreibung = b;
    if (isPrioritaet(it.prioritaet)) entry.prioritaet = it.prioritaet;
    const vh = asText(it.verantwortlich_hint);
    if (vh) entry.verantwortlich_hint = vh;
    const fh = asText(it.frist_hint);
    if (fh) entry.frist_hint = fh;
    aufgaben.push(entry);
  }
  const hinweis = asText(o.hinweis);
  return {
    aufgaben,
    ...(hinweis ? { hinweis } : {}),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    if (!isLlmConfigured()) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'LLM-Konfiguration fehlt.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    const { id: documentId } = await params;
    const access = await resolveUserAccess(user.email, supabase);
    const schoolProfile = await getSchoolProfileText(access.schoolNumber);
    const aiSettings = await getAiSettingsForSchool(access.schoolNumber);
    const debugEnabled = isAiQueryDebugEnabledEffective(aiSettings.debug_log_enabled);

    const body = (await req.json().catch(() => ({}))) as { force?: boolean };
    const force = Boolean(body.force);

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select(
        'id, title, document_type_code, created_at, status, current_version_id, protection_class_id, responsible_unit, school_number, gremium, reach_scope, participation_groups, review_date, legal_reference, summary, steering_todos, steering_todos_updated_at, steering_todos_version_id, schulentwicklung_primary_field, schulentwicklung_fields',
      )
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return apiError(404, 'NOT_FOUND', 'Dokument nicht gefunden.');
    }

    const docSchool = (doc as { school_number?: string | null }).school_number ?? null;
    const mayAccessSchool = canAccessSchool(access, docSchool);
    const mayAccess = canReadDocument(
      access,
      (doc as { protection_class_id?: number | null }).protection_class_id,
      doc.responsible_unit ?? null,
    );
    if (!mayAccessSchool || !mayAccess) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für dieses Dokument.');
    }

    const schoolFlags = await loadSchoolFeatureFlags(supabase, docSchool ?? access.schoolNumber);

    const cached = normalizeTodos((doc as { steering_todos?: unknown }).steering_todos);
    const cachedVersionId = (doc as { steering_todos_version_id?: string | null }).steering_todos_version_id ?? null;
    const currentVersionId = (doc as { current_version_id?: string | null }).current_version_id ?? null;
    const cacheIsFresh = cached && cachedVersionId && currentVersionId && cachedVersionId === currentVersionId;
    if (!force && cacheIsFresh) {
      return NextResponse.json({
        todos: cached,
        cached: true,
        updatedAt: (doc as { steering_todos_updated_at?: string | null }).steering_todos_updated_at ?? null,
      });
    }

    const aiBlocked = apiResponseIfAiDisabled(schoolFlags);
    if (aiBlocked) return aiBlocked;

    const { getDocumentText } = await import('../../../../../lib/documentText');
    const extracted = await getDocumentText(documentId);
    const legalRef = (doc.legal_reference as string | null)?.trim() ?? '';
    let basisText = (extracted ?? '').trim();
    if (!basisText) basisText = legalRef;
    if (!basisText || basisText.length < 40) {
      return apiError(400, 'VALIDATION_ERROR', 'Für dieses Dokument steht kein ausreichender Text zur Aufgabenextraktion zur Verfügung.');
    }

    if (basisText.length > 14000) {
      basisText = basisText.slice(0, 14000) + '…';
    }

    const chunkParams = {
      chunkChars: Math.max(500, Math.floor(aiSettings.chunk_chars ?? 2500)),
      overlapChars: Math.max(0, Math.floor(aiSettings.chunk_overlap_chars ?? 300)),
      maxChunks: Math.max(1, Math.floor(aiSettings.max_chunks_per_doc ?? 3)),
    };
    const chunks = chunkTextByParagraphs(basisText, chunkParams).slice(0, chunkParams.maxChunks);

    const promptTemplate = await getSchoolPromptTemplate(access.schoolNumber ?? '000000', 'todos');
    const systemPrompt = [promptTemplate.system_locked, promptTemplate.system_editable]
      .filter(Boolean)
      .join('\n\n')
      .trim();
    const schoolContextBlock = schoolProfile ? `Schul-Steckbrief:\n${schoolProfile}\n\n` : '';
    const userPromptTemplate = [promptTemplate.user_locked, promptTemplate.user_editable]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    const dr = doc as {
      id: string;
      title?: string | null;
      document_type_code?: string | null;
      created_at?: string | null;
      status?: string | null;
      legal_reference?: string | null;
      responsible_unit?: string | null;
      gremium?: string | null;
      reach_scope?: 'intern' | 'extern' | null;
      participation_groups?: unknown;
      review_date?: string | null;
      summary?: string | null;
      schulentwicklung_primary_field?: string | null;
      schulentwicklung_fields?: unknown;
    };
    const pgRaw = dr.participation_groups;
    const participationGroups =
      Array.isArray(pgRaw) && pgRaw.every((x) => typeof x === 'string') ? (pgRaw as string[]) : null;
    const swFieldsRaw = dr.schulentwicklung_fields;
    const schulentwicklungFields =
      Array.isArray(swFieldsRaw) && swFieldsRaw.every((x) => typeof x === 'string')
        ? (swFieldsRaw as string[])
        : null;

    const docRow: DocRow = {
      id: dr.id,
      title: (dr.title ?? '').trim() || 'Unbenannt',
      document_type_code: (dr.document_type_code ?? '').trim() || '—',
      created_at: dr.created_at ?? new Date().toISOString(),
      status: dr.status ?? null,
      legal_reference: dr.legal_reference ?? null,
      responsible_unit: dr.responsible_unit ?? null,
      gremium: dr.gremium ?? null,
      reach_scope: dr.reach_scope === 'intern' || dr.reach_scope === 'extern' ? dr.reach_scope : null,
      participation_groups: participationGroups,
      review_date: dr.review_date ?? null,
      summary: dr.summary ?? null,
      schulentwicklung_primary_field: dr.schulentwicklung_primary_field ?? null,
      schulentwicklung_fields: schulentwicklungFields,
    };
    const documentMetadataBlock = buildDocumentMetadataPromptSection(docRow);

    const userPrompt = renderPromptTemplate(userPromptTemplate, {
      document_title: (dr.title ?? '').trim() || 'Unbenanntes Dokument',
      document_metadata_block: documentMetadataBlock,
      school_profile_block: schoolContextBlock,
      document_text: basisText,
    });

    if (debugEnabled) {
      void appendAiDebugEvent(
        'documents/steering-todos',
        {
          schoolNumber: access.schoolNumber,
          documentId,
          title: doc.title,
          documentMetadataBlockLength: documentMetadataBlock.length,
          basisTextLength: basisText.length,
          chunkParams,
          selectedChunks: chunks,
          promptTemplateVersion: promptTemplate.version,
          systemPrompt,
          userPrompt,
        },
        aiSettings.debug_log_enabled,
      );
    }

    let didRetry = false;
    let usedRepair = false;
    const schoolForUsage = access.schoolNumber ?? '000000';
    let raw = await callLlm(systemPrompt, userPrompt, {
      timeoutMs: aiSettings.llm_timeout_ms,
      usage: {
        supabase,
        schoolNumber: schoolForUsage,
        useCase: 'todos',
        metadata: { document_id: documentId, phase: 'primary' },
      },
    });
    let parsed = extractJsonObject(raw);
    let todos = normalizeTodos(parsed);

    if (!todos) {
      didRetry = true;
      const retrySystemPrompt = `${systemPrompt}

WICHTIG:
- Gib NUR ein gültiges JSON-Objekt zurück.
- Keine Markdown-Codeblöcke.
- Keine Einleitung außerhalb des JSON.`;
      const retryUserPrompt = `${userPrompt}

Antworte jetzt ausschließlich mit einem syntaktisch gültigen JSON-Objekt gemäß Schema (aufgaben, optional hinweis).`;
      raw = await callLlm(retrySystemPrompt, retryUserPrompt, {
        timeoutMs: aiSettings.llm_timeout_ms,
        usage: {
          supabase,
          schoolNumber: schoolForUsage,
          useCase: 'todos',
          metadata: { document_id: documentId, phase: 'retry' },
        },
      });
      parsed = extractJsonObject(raw);
      todos = normalizeTodos(parsed);
    }

    if (!todos) {
      usedRepair = true;
      const repairSystemPrompt = `Du bist ein JSON-Reparatur-Assistent.
Gib ausschließlich ein syntaktisch gültiges JSON-Objekt zurück.
Keine Markdown-Backticks, keine Zusatztexte.`;
      const repairUserPrompt = `Schema:
{
  "aufgaben": [ { "titel": "", "beschreibung": "", "prioritaet": "niedrig|mittel|hoch", "verantwortlich_hint": "", "frist_hint": "" } ],
  "hinweis": ""
}

Defekte Antwort:
${raw}`;
      raw = await callLlm(repairSystemPrompt, repairUserPrompt, {
        timeoutMs: aiSettings.llm_timeout_ms,
        usage: {
          supabase,
          schoolNumber: schoolForUsage,
          useCase: 'todos',
          metadata: { document_id: documentId, phase: 'repair' },
        },
      });
      parsed = extractJsonObject(raw);
      todos = normalizeTodos(parsed);
    }

    if (debugEnabled) {
      void appendAiDebugEvent(
        'documents/steering-todos-response',
        {
          schoolNumber: access.schoolNumber,
          documentId,
          parseSuccess: Boolean(todos),
          usedRetry: didRetry,
          usedRepair,
          rawResponse: raw.length > 12000 ? `${raw.slice(0, 12000)}…` : raw,
          parsedResponse: parsed,
        },
        aiSettings.debug_log_enabled,
      );
    }

    if (!todos) {
      return apiError(500, 'INTERNAL_ERROR', 'KI-Antwort konnte nicht als gültige Aufgabenliste verarbeitet werden.');
    }

    let updateQuery = supabase
      .from('documents')
      .update({
        steering_todos: todos,
        steering_todos_updated_at: new Date().toISOString(),
        steering_todos_version_id: currentVersionId,
      })
      .eq('id', documentId);
    if (docSchool) updateQuery = updateQuery.eq('school_number', docSchool);
    await updateQuery;

    const updatedAt = new Date().toISOString();
    return NextResponse.json({ todos, cached: false, updatedAt });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
