import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { canAccessSchool, canReadDocument, getUserAccessContext } from '../../../../../lib/documentAccess';
import { getDocumentText } from '../../../../../lib/documentText';
import { callLlm, isLlmConfigured } from '../../../../../lib/llmClient';
import { getSchoolProfileText } from '../../../../../lib/schoolProfile';
import { getAiSettingsForSchool } from '../../../../../lib/aiSettings';
import { appendAiDebugEvent, isAiQueryDebugEnabledEffective } from '../../../../../lib/aiQueryDebugLog';

export const runtime = 'nodejs';

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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: 'LLM-Umgebungsvariablen sind nicht gesetzt.' }, { status: 500 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    }

    const { id: documentId } = await params;
    const access = await getUserAccessContext(user.email, supabase);
    const schoolProfile = await getSchoolProfileText(access.schoolNumber);
    const aiSettings = await getAiSettingsForSchool(access.schoolNumber);
    const debugEnabled = isAiQueryDebugEnabledEffective(aiSettings.debug_log_enabled);

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, title, protection_class_id, responsible_unit, school_number, legal_reference')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokument nicht gefunden.' }, { status: 404 });
    }

    const docSchool = (doc as { school_number?: string | null }).school_number ?? null;
    const mayAccessSchool = canAccessSchool(access, docSchool);
    const mayAccess = canReadDocument(
      access,
      (doc as { protection_class_id?: number | null }).protection_class_id,
      doc.responsible_unit ?? null
    );
    if (!mayAccessSchool || !mayAccess) {
      return NextResponse.json({ error: 'Keine Berechtigung für dieses Dokument.' }, { status: 403 });
    }

    const extracted = await getDocumentText(documentId);
    const legalRef = (doc.legal_reference as string | null)?.trim() ?? '';
    let basisText = (extracted ?? '').trim();
    if (!basisText) basisText = legalRef;
    if (!basisText || basisText.length < 60) {
      return NextResponse.json(
        { error: 'Für dieses Dokument steht kein ausreichender analysierbarer Text zur Verfügung.' },
        { status: 400 }
      );
    }

    if (basisText.length > 14000) {
      basisText = basisText.slice(0, 14000) + '…';
    }

    const systemPrompt = `Du bist ein Experte für Schulorganisation und institutionelle Steuerung im deutschen Schulsystem.

Du analysierst schulische Dokumente nicht inhaltlich, sondern strukturell entlang eines Steuerungsmodells.

Das Modell umfasst vier Dimensionen:
1. Tragfähigkeit (Organisation)
2. Belastungsgrad (Dokument)
3. Entscheidungsstruktur
4. Verbindlichkeit

Arbeite streng textbasiert:
- Keine Annahmen außerhalb des Dokuments
- Keine Interpretation von Intentionen ohne Textbeleg
- Präzise, kurze Begründungen (maximal 2 Sätze)

Nutze ausschließlich diese Skala:
- niedrig
- mittel
- hoch

Bestimme die PASSUNG:
- gut → Tragfähigkeit ≥ Belastungsgrad
- kritisch → Tragfähigkeit < Belastungsgrad

Leite daraus die Gesamtbewertung ab:
- niedriger Steuerungsbedarf
- mittlerer Steuerungsbedarf
- hoher Steuerungsbedarf

Antworte ausschließlich als JSON im geforderten Format.`;

    const schoolContextBlock = schoolProfile ? `Schul-Steckbrief:\n${schoolProfile}\n\n` : '';

    const userPrompt = `Analysiere das folgende Dokument anhand der vier Dimensionen.

Dokumenttitel: ${doc.title}

${schoolContextBlock}Dokumenttext:
${basisText}

Antwortformat:
{
  "tragfaehigkeit": { "score": "", "begruendung": "" },
  "belastungsgrad": { "score": "", "begruendung": "" },
  "entscheidungsstruktur": { "score": "", "begruendung": "" },
  "verbindlichkeit": { "score": "", "begruendung": "" },
  "passung": { "score": "", "begruendung": "" },
  "gesamtbewertung": { "score": "", "begruendung": "" }
}`;

    if (debugEnabled) {
      void appendAiDebugEvent(
        'documents/steering-analysis',
        {
          schoolNumber: access.schoolNumber,
          documentId,
          title: doc.title,
          basisTextLength: basisText.length,
          systemPrompt,
          userPrompt,
        },
        aiSettings.debug_log_enabled
      );
    }

    let didRetry = false;
    let usedRepair = false;
    let raw = await callLlm(systemPrompt, userPrompt);
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
      raw = await callLlm(retrySystemPrompt, retryUserPrompt);
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
      raw = await callLlm(repairSystemPrompt, repairUserPrompt);
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
      return NextResponse.json(
        { error: 'KI-Antwort konnte nicht als gültige Analyse verarbeitet werden.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

