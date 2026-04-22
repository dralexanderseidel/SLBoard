import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../../../lib/documentAccess';
import { callLlm, isLlmConfigured } from '../../../../../lib/llmClient';
import { getSchoolProfileText } from '../../../../../lib/schoolProfile';
import { getAiSettingsForSchool } from '../../../../../lib/aiSettings';
import { appendAiDebugEvent, isAiQueryDebugEnabledEffective } from '../../../../../lib/aiQueryDebugLog';
import { apiError } from '../../../../../lib/apiError';
import { chunkTextByParagraphs } from '../../../../../lib/chunkingOnTheFly';
import { getSchoolPromptTemplate, renderPromptTemplate } from '../../../../../lib/aiPromptTemplates';
import { buildDocumentMetadataPromptSection, type DocRow } from '../../../../../lib/aiSearch';

export const runtime = 'nodejs';

/** Vercel: PDF-Extraktion + großer KI-Prompt überschreiten oft 10s. */
export const maxDuration = 60;

type AnalysisScore = 'niedrig' | 'mittel' | 'hoch';
type PassungScore = 'gut' | 'kritisch';
type GesamtScore = 'niedriger Steuerungsbedarf' | 'mittlerer Steuerungsbedarf' | 'hoher Steuerungsbedarf';

type SteeringAnalysis = {
  tragfaehigkeit: { score: AnalysisScore; begruendung: string };
  belastungsgrad: { score: AnalysisScore; begruendung: string };
  entscheidungsstruktur: { score: AnalysisScore; begruendung: string };
  verbindlichkeit: { score: AnalysisScore; begruendung: string };
  passung: { score: PassungScore; begruendung: string };
  gesamtbewertung: { score: GesamtScore; begruendung: string };
};

function extractJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // try fenced markdown JSON
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function isAnalysisScore(v: unknown): v is AnalysisScore {
  return v === 'niedrig' || v === 'mittel' || v === 'hoch';
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeAnalysis(raw: unknown): SteeringAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const t = o.tragfaehigkeit as Record<string, unknown> | undefined;
  const b = o.belastungsgrad as Record<string, unknown> | undefined;
  const e = o.entscheidungsstruktur as Record<string, unknown> | undefined;
  const v = o.verbindlichkeit as Record<string, unknown> | undefined;
  const p = o.passung as Record<string, unknown> | undefined;
  const g = o.gesamtbewertung as Record<string, unknown> | undefined;

  if (!t || !b || !e || !v || !p || !g) return null;
  if (!isAnalysisScore(t.score) || !isAnalysisScore(b.score) || !isAnalysisScore(e.score) || !isAnalysisScore(v.score)) {
    return null;
  }
  const passungScore = p.score;
  const gesamtScore = g.score;
  if (passungScore !== 'gut' && passungScore !== 'kritisch') return null;
  if (
    gesamtScore !== 'niedriger Steuerungsbedarf' &&
    gesamtScore !== 'mittlerer Steuerungsbedarf' &&
    gesamtScore !== 'hoher Steuerungsbedarf'
  ) {
    return null;
  }

  return {
    tragfaehigkeit: { score: t.score, begruendung: asText(t.begruendung) },
    belastungsgrad: { score: b.score, begruendung: asText(b.begruendung) },
    entscheidungsstruktur: { score: e.score, begruendung: asText(e.begruendung) },
    verbindlichkeit: { score: v.score, begruendung: asText(v.begruendung) },
    passung: { score: passungScore, begruendung: asText(p.begruendung) },
    gesamtbewertung: { score: gesamtScore, begruendung: asText(g.begruendung) },
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
        'id, title, document_type_code, created_at, status, current_version_id, protection_class_id, responsible_unit, school_number, gremium, reach_scope, participation_groups, review_date, legal_reference, summary, steering_analysis, steering_analysis_updated_at, steering_analysis_version_id'
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
      doc.responsible_unit ?? null
    );
    if (!mayAccessSchool || !mayAccess) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für dieses Dokument.');
    }

    const cached = normalizeAnalysis((doc as { steering_analysis?: unknown }).steering_analysis);
    const cachedVersionId = (doc as { steering_analysis_version_id?: string | null }).steering_analysis_version_id ?? null;
    const currentVersionId = (doc as { current_version_id?: string | null }).current_version_id ?? null;
    const cacheIsFresh = cached && cachedVersionId && currentVersionId && cachedVersionId === currentVersionId;
    if (!force && cacheIsFresh) {
      return NextResponse.json({
        analysis: cached,
        cached: true,
        updatedAt: (doc as { steering_analysis_updated_at?: string | null }).steering_analysis_updated_at ?? null,
      });
    }

    const { getDocumentText } = await import('../../../../../lib/documentText');
    const extracted = await getDocumentText(documentId);
    const legalRef = (doc.legal_reference as string | null)?.trim() ?? '';
    let basisText = (extracted ?? '').trim();
    if (!basisText) basisText = legalRef;
    if (!basisText || basisText.length < 60) {
      return apiError(400, 'VALIDATION_ERROR', 'Für dieses Dokument steht kein ausreichender analysierbarer Text zur Verfügung.');
    }

    if (basisText.length > 14000) {
      basisText = basisText.slice(0, 14000) + '…';
    }

    const steeringChunkParams = {
      chunkChars: Math.max(500, Math.floor(aiSettings.chunk_chars ?? 2500)),
      overlapChars: Math.max(0, Math.floor(aiSettings.chunk_overlap_chars ?? 300)),
      maxChunks: Math.max(1, Math.floor(aiSettings.max_chunks_per_doc ?? 3)),
    };
    const steeringChunks = chunkTextByParagraphs(basisText, steeringChunkParams).slice(
      0,
      steeringChunkParams.maxChunks
    );

    const promptTemplate = await getSchoolPromptTemplate(access.schoolNumber ?? '000000', 'steering');
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
    };
    const pgRaw = dr.participation_groups;
    const participationGroups =
      Array.isArray(pgRaw) && pgRaw.every((x) => typeof x === 'string') ? (pgRaw as string[]) : null;

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
        'documents/steering-analysis',
        {
          schoolNumber: access.schoolNumber,
          documentId,
          title: doc.title,
          documentMetadataBlockLength: documentMetadataBlock.length,
          basisTextLength: basisText.length,
          chunkParams: steeringChunkParams,
          selectedChunks: steeringChunks,
          promptTemplateVersion: promptTemplate.version,
          systemPrompt,
          userPrompt,
        },
        aiSettings.debug_log_enabled
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
        useCase: 'steering',
        metadata: { document_id: documentId, phase: 'primary' },
      },
    });
    let parsed = extractJsonObject(raw);
    let analysis = normalizeAnalysis(parsed);

    // Fallback: falls das erste Modell-Output nicht parsebar ist (z.B. abgeschnittenes JSON),
    // erzwingen wir einen zweiten, strengeren JSON-Versuch.
    if (!analysis) {
      didRetry = true;
      const retrySystemPrompt = `${systemPrompt}

WICHTIG:
- Gib NUR ein gültiges JSON-Objekt zurück.
- Keine Markdown-Codeblöcke.
- Keine Einleitung, keine Erklärungen außerhalb des JSON.`;
      const retryUserPrompt = `${userPrompt}

Antworte jetzt ausschließlich mit einem syntaktisch gültigen JSON-Objekt.`;
      raw = await callLlm(retrySystemPrompt, retryUserPrompt, {
        timeoutMs: aiSettings.llm_timeout_ms,
        usage: {
          supabase,
          schoolNumber: schoolForUsage,
          useCase: 'steering',
          metadata: { document_id: documentId, phase: 'retry' },
        },
      });
      parsed = extractJsonObject(raw);
      analysis = normalizeAnalysis(parsed);
    }

    // Letzter Fallback: abgeschnittene/inkonsistente JSON-Antwort reparieren lassen.
    if (!analysis) {
      usedRepair = true;
      const repairSystemPrompt = `Du bist ein JSON-Reparatur-Assistent.
Du bekommst eine unvollständige oder fehlerhafte KI-Antwort.
Gib ausschließlich ein syntaktisch gültiges JSON-Objekt im geforderten Schema zurück.
Keine Markdown-Backticks, keine Zusatztexte.`;
      const repairUserPrompt = `Schema:
{
  "tragfaehigkeit": { "score": "niedrig|mittel|hoch", "begruendung": "" },
  "belastungsgrad": { "score": "niedrig|mittel|hoch", "begruendung": "" },
  "entscheidungsstruktur": { "score": "niedrig|mittel|hoch", "begruendung": "" },
  "verbindlichkeit": { "score": "niedrig|mittel|hoch", "begruendung": "" },
  "passung": { "score": "gut|kritisch", "begruendung": "" },
  "gesamtbewertung": { "score": "niedriger Steuerungsbedarf|mittlerer Steuerungsbedarf|hoher Steuerungsbedarf", "begruendung": "" }
}

Defekte Antwort:
${raw}
`;
      raw = await callLlm(repairSystemPrompt, repairUserPrompt, {
        timeoutMs: aiSettings.llm_timeout_ms,
        usage: {
          supabase,
          schoolNumber: schoolForUsage,
          useCase: 'steering',
          metadata: { document_id: documentId, phase: 'repair' },
        },
      });
      parsed = extractJsonObject(raw);
      analysis = normalizeAnalysis(parsed);
    }

    if (debugEnabled) {
      void appendAiDebugEvent(
        'documents/steering-analysis-response',
        {
          schoolNumber: access.schoolNumber,
          documentId,
          parseSuccess: Boolean(analysis),
          usedRetry: didRetry,
          usedRepair,
          rawResponse: raw.length > 12000 ? `${raw.slice(0, 12000)}…` : raw,
          parsedResponse: parsed,
        },
        aiSettings.debug_log_enabled
      );
    }

    if (!analysis) {
      return apiError(500, 'INTERNAL_ERROR', 'KI-Antwort konnte nicht als gültige Analyse verarbeitet werden.');
    }

    let updateQuery = supabase
      .from('documents')
      .update({
        steering_analysis: analysis,
        steering_analysis_updated_at: new Date().toISOString(),
        steering_analysis_version_id: currentVersionId,
      })
      .eq('id', documentId);
    if (docSchool) updateQuery = updateQuery.eq('school_number', docSchool);
    await updateQuery;

    return NextResponse.json({ analysis, cached: false });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

