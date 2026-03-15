import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { getDocumentText } from '../../../../lib/documentText';
import { callLlm, isLlmConfigured } from '../../../../lib/llmClient';

const MAX_DOCS = 8;
const MAX_TEXT_PER_DOC = 3000;
const SEARCH_POOL = 25;

const STOP_WORDS = new Set([
  'und', 'oder', 'der', 'die', 'das', 'ein', 'eine', 'bei', 'von', 'zu', 'zur', 'mit', 'für',
  'auf', 'ist', 'sind', 'wird', 'werden', 'hat', 'haben', 'kann', 'können', 'soll', 'sollen',
  'was', 'wie', 'welche', 'welcher', 'wann', 'wo', 'warum', 'wer',
]);

/** Typische Zusammensetzungen, um z.B. "Handykonzept" → "handy", "konzept" zu ergänzen */
const COMPOUND_PARTS = new Set([
  'handy', 'konzept', 'nutzung', 'medien', 'schule', 'schüler', 'eltern', 'leistung',
  'bewertung', 'oberstufe', 'unterricht', 'pausen', 'regel', 'ordnung',
]);

function expandCompoundKeyword(word: string): string[] {
  const low = word.toLowerCase();
  const result = new Set<string>([low]);
  for (const part of COMPOUND_PARTS) {
    if (low.includes(part) && part.length >= 4) {
      result.add(part);
      const rest = low.replace(part, ' ').trim();
      if (rest.length >= 4 && !STOP_WORDS.has(rest)) {
        result.add(rest);
      }
    }
  }
  return [...result];
}

function extractKeywords(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^\wäöüß\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  const expanded = new Set<string>();
  for (const w of words) {
    for (const kw of expandCompoundKeyword(w)) {
      if (kw.length >= 3 && !STOP_WORDS.has(kw)) expanded.add(kw);
    }
  }
  return [...expanded];
}

type DocRow = {
  id: string;
  title: string;
  document_type_code: string;
  created_at: string;
  legal_reference: string | null;
  responsible_unit: string | null;
  gremium: string | null;
  summary: string | null;
};

function scoreRelevance(doc: DocRow, keywords: string[]): number {
  const title = (doc.title ?? '').toLowerCase();
  const legalRef = (doc.legal_reference ?? '').toLowerCase();
  const unit = (doc.responsible_unit ?? '').toLowerCase();
  const gremium = (doc.gremium ?? '').toLowerCase();
  const summary = (doc.summary ?? '').toLowerCase();
  const combined = `${title} ${legalRef} ${unit} ${gremium} ${summary}`;
  return keywords.filter((k) => combined.includes(k.toLowerCase())).length;
}

export async function POST(req: NextRequest) {
  try {
    const { question } = (await req.json()) as { question?: string };
    const trimmed = typeof question === 'string' ? question.trim() : '';

    if (!trimmed) {
      return NextResponse.json(
        { error: 'Bitte geben Sie eine Frage ein.' },
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

    const keywords = extractKeywords(trimmed);
    let docList: DocRow[] = [];

    if (keywords.length > 0) {
      const orParts: string[] = [];
      const cols = [
        'title',
        'legal_reference',
        'responsible_unit',
        'document_type_code',
        'gremium',
        'summary',
      ];
      for (const kw of keywords) {
        const pattern = `%${kw}%`;
        for (const col of cols) {
          orParts.push(`${col}.ilike.${pattern}`);
        }
      }
      const { data: relevant } = await supabase
        .from('documents')
        .select(
          'id, title, document_type_code, created_at, legal_reference, responsible_unit, gremium, summary',
        )
        .in('status', ['ENTWURF', 'FREIGEGEBEN', 'VEROEFFENTLICHT'])
        .or(orParts.join(','))
        .order('created_at', { ascending: false })
        .limit(SEARCH_POOL);
      const typed = (relevant ?? []) as DocRow[];
      if (typed.length > 0) {
        typed.sort((a, b) => scoreRelevance(b, keywords) - scoreRelevance(a, keywords));
        docList = typed.slice(0, MAX_DOCS);
      }
    }

    if (docList.length === 0) {
      const { data: fallback } = await supabase
        .from('documents')
        .select(
          'id, title, document_type_code, created_at, legal_reference, responsible_unit, gremium, summary',
        )
        .in('status', ['ENTWURF', 'FREIGEGEBEN', 'VEROEFFENTLICHT'])
        .order('created_at', { ascending: false })
        .limit(MAX_DOCS);
      docList = (fallback ?? []) as DocRow[];
    }

    const sourceTexts: { id: string; title: string; snippet: string }[] = [];

    for (const doc of docList) {
      // Bevorzugt Zusammenfassung, sonst Volltext aus Datei
      const summaryText = (doc.summary ?? '').trim();
      let text = summaryText.length > 30 ? summaryText : null;
      if (!text) {
        text = await getDocumentText(doc.id);
      }
      if (!text) text = (doc.legal_reference as string)?.trim() ?? '';
      if (text && text.length > 30) {
        const snippet = text.slice(0, MAX_TEXT_PER_DOC) + (text.length > MAX_TEXT_PER_DOC ? '…' : '');
        sourceTexts.push({ id: doc.id, title: doc.title, snippet });
      }
    }

    const contextBlock =
      sourceTexts.length > 0
        ? sourceTexts
            .map((s) => `--- ${s.title} ---\n${s.snippet}`)
            .join('\n\n')
        : 'Es wurden keine passenden Dokumente gefunden.';

    const systemPrompt = `Du bist ein deutscher Assistent für schulische Verwaltungsdokumente.
Beantworte die Nutzerfrage NUR auf Basis der bereitgestellten Dokumentpassagen.
Wenn die Dokumente die Frage nicht beantworten, sage das klar.
Zitiere keine Quellen wörtlich, fasse zusammen. Nenne am Ende die verwendeten Dokumenttitel.`;

    const userPrompt = `Frage des Nutzers: ${trimmed}

Dokumentpassagen:
${contextBlock}

Antworte in 3–6 Sätzen.`;

    const answer = await callLlm(systemPrompt, userPrompt);

    const userId = '00000000-0000-0000-0000-000000000001';
    await supabase.from('ai_queries').insert({
      user_id: userId,
      question: trimmed,
      answer_excerpt: answer.slice(0, 500),
      used_document_ids: sourceTexts.map((s) => s.id),
      success: true,
    });

    return NextResponse.json({
      answer,
      sources: sourceTexts.map((s) => ({
        documentId: s.id,
        title: s.title,
        snippet: s.snippet.slice(0, 200) + (s.snippet.length > 200 ? '…' : ''),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
