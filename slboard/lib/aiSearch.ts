/**
 * Gemeinsame Suchlogik für KI: Keyword-Extraktion, Relevanz-Score, Dokumentenliste.
 */
import { supabaseServer } from './supabaseServer';

export const SEARCH_POOL = 25;
export const MAX_DOCS = 8;

const STOP_WORDS = new Set([
  'und', 'oder', 'der', 'die', 'das', 'ein', 'eine', 'bei', 'von', 'zu', 'zur', 'mit', 'für',
  'auf', 'ist', 'sind', 'wird', 'werden', 'hat', 'haben', 'kann', 'können', 'soll', 'sollen',
  'was', 'wie', 'welche', 'welcher', 'wann', 'wo', 'warum', 'wer',
]);

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

export function extractKeywords(question: string): string[] {
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

export type DocRow = {
  id: string;
  title: string;
  document_type_code: string;
  created_at: string;
  legal_reference: string | null;
  responsible_unit: string | null;
  gremium: string | null;
  summary: string | null;
};

export function scoreRelevance(doc: DocRow, keywords: string[]): number {
  const title = (doc.title ?? '').toLowerCase();
  const legalRef = (doc.legal_reference ?? '').toLowerCase();
  const unit = (doc.responsible_unit ?? '').toLowerCase();
  const gremium = (doc.gremium ?? '').toLowerCase();
  const summary = (doc.summary ?? '').toLowerCase();
  const combined = `${title} ${legalRef} ${unit} ${gremium} ${summary}`;
  return keywords.filter((k) => combined.includes(k.toLowerCase())).length;
}

/**
 * Sucht Dokumente nach Frage (Keywords), sortiert nach Relevanz. Kein LLM.
 */
export async function getSuggestedDocuments(question: string): Promise<DocRow[]> {
  const supabase = supabaseServer();
  if (!supabase) return [];

  const keywords = extractKeywords(question);
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

  return docList;
}

/**
 * Lädt Dokumente anhand von IDs (für KI-Anfrage mit fest gewählter Liste).
 */
export async function getDocumentsByIds(ids: string[]): Promise<DocRow[]> {
  const supabase = supabaseServer();
  if (!supabase || ids.length === 0) return [];

  const { data } = await supabase
    .from('documents')
    .select(
      'id, title, document_type_code, created_at, legal_reference, responsible_unit, gremium, summary',
    )
    .in('id', ids)
    .in('status', ['ENTWURF', 'FREIGEGEBEN', 'VEROEFFENTLICHT']);

  const order = new Map(ids.map((id, i) => [id, i]));
  const list = (data ?? []) as DocRow[];
  list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return list;
}
