/**
 * Gemeinsame Suchlogik für KI: Keyword-Extraktion, Relevanz-Score, Dokumentenliste.
 */
import { supabaseServer } from './supabaseServer';
import { WORKFLOW_STATUS_ORDER, statusLabelDe } from './documentWorkflow';

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
  /** Workflow-Status (ENTWURF, …) — für KI-Metadatenkontext */
  status?: string | null;
  legal_reference: string | null;
  responsible_unit: string | null;
  gremium: string | null;
  reach_scope?: 'intern' | 'extern' | null;
  participation_groups?: string[] | null;
  review_date?: string | null;
  summary: string | null;
  search_text?: string | null;
  keywords?: string[] | null;
};

/**
 * Deutscher Textblock mit Dokumentmetadaten für KI-QA (Gremium, Status, Fristen, …).
 */
export function buildDocumentMetadataPromptSection(doc: DocRow): string {
  const lines: string[] = [
    'Metadaten (verbindlich für Fragen zu Gremium, Status, Reichweite, Review, Verantwortung):',
  ];
  lines.push(`- Dokumenttyp (Code): ${doc.document_type_code ?? '—'}`);
  if (doc.status) {
    lines.push(`- Workflow-Status: ${statusLabelDe(doc.status)}`);
  }
  try {
    const d = new Date(doc.created_at);
    if (!Number.isNaN(d.getTime())) {
      lines.push(`- Erstellungsdatum: ${d.toLocaleDateString('de-DE')}`);
    }
  } catch {
    // ignore
  }
  const unit = doc.responsible_unit?.trim();
  if (unit) lines.push(`- Verantwortliche Organisationseinheit: ${unit}`);
  const gr = doc.gremium?.trim();
  if (gr) lines.push(`- Beschlussgremium: ${gr}`);
  if (doc.reach_scope === 'intern' || doc.reach_scope === 'extern') {
    lines.push(`- Reichweite: ${doc.reach_scope}`);
  }
  const pg = doc.participation_groups;
  if (Array.isArray(pg) && pg.length > 0) {
    lines.push(`- Beteiligung (Gruppen): ${pg.join(', ')}`);
  }
  const rd = doc.review_date?.trim();
  if (rd) lines.push(`- Review-Datum: ${rd}`);
  const lr = doc.legal_reference?.trim();
  if (lr) {
    lines.push(`- Rechtsbezug (Metadatenfeld): ${lr.length > 450 ? `${lr.slice(0, 450)}…` : lr}`);
  }
  const sum = doc.summary?.trim();
  if (sum && sum.length > 0) {
    lines.push(
      `- Kurzbeschreibung (Metadaten): ${sum.length > 600 ? `${sum.slice(0, 600)}…` : sum}`,
    );
  }
  lines.push(
    '- Hinweis: Konkrete Zeitpunkte einzelner Workflow-Schritte (z. B. wie lange „Entwurf“ dauerte) sind in diesen Metadaten nicht als Historie gespeichert; sichtbar sind Erstellungsdatum und aktueller Status. Für Zeitverläufe ggf. Versions- oder Änderungsverlauf prüfen.',
  );
  return lines.join('\n');
}

export function scoreRelevance(doc: DocRow, keywords: string[]): number {
  const title = (doc.title ?? '').toLowerCase();
  const legalRef = (doc.legal_reference ?? '').toLowerCase();
  const unit = (doc.responsible_unit ?? '').toLowerCase();
  const gremium = (doc.gremium ?? '').toLowerCase();
  const summary = (doc.summary ?? '').toLowerCase();
  const searchText = (doc.search_text ?? '').toLowerCase();
  const kw = (doc.keywords ?? []).join(' ').toLowerCase();
  const combined = `${title} ${searchText} ${kw} ${summary} ${legalRef} ${unit} ${gremium}`;
  return keywords.filter((k) => combined.includes(k.toLowerCase())).length;
}

/**
 * Sucht Dokumente nach Frage (Keywords), sortiert nach Relevanz. Kein LLM.
 */
export async function getSuggestedDocuments(question: string, schoolNumber?: string | null): Promise<DocRow[]> {
  const supabase = supabaseServer();
  if (!supabase) return [];

  const keywords = extractKeywords(question);
  let docList: DocRow[] = [];

  if (keywords.length > 0) {
    const orParts: string[] = [];
    const cols = [
      'title',
      'search_text',
      'summary',
      'legal_reference',
      'keywords',
      'responsible_unit',
      'document_type_code',
      'gremium',
    ];
    for (const kw of keywords) {
      const pattern = `%${kw}%`;
      for (const col of cols) {
        orParts.push(`${col}.ilike.${pattern}`);
      }
    }
    let relevantQuery = supabase
      .from('documents')
      .select(
        'id, title, document_type_code, created_at, status, reach_scope, participation_groups, review_date, legal_reference, responsible_unit, gremium, summary, search_text, keywords',
      )
      .is('archived_at', null)
      .in('status', [...WORKFLOW_STATUS_ORDER])
      .or(orParts.join(','))
      .order('created_at', { ascending: false })
      .limit(SEARCH_POOL);
    if (schoolNumber) relevantQuery = relevantQuery.eq('school_number', schoolNumber);
    const { data: relevant } = await relevantQuery;
    const typed = (relevant ?? []) as DocRow[];
    if (typed.length > 0) {
      typed.sort((a, b) => scoreRelevance(b, keywords) - scoreRelevance(a, keywords));
      docList = typed.slice(0, MAX_DOCS);
    }
  }

  if (docList.length === 0) {
    let fallbackQuery = supabase
      .from('documents')
      .select(
        'id, title, document_type_code, created_at, status, reach_scope, participation_groups, review_date, legal_reference, responsible_unit, gremium, summary, search_text, keywords',
      )
      .is('archived_at', null)
      .in('status', [...WORKFLOW_STATUS_ORDER])
      .order('created_at', { ascending: false })
      .limit(MAX_DOCS);
    if (schoolNumber) fallbackQuery = fallbackQuery.eq('school_number', schoolNumber);
    const { data: fallback } = await fallbackQuery;
    docList = (fallback ?? []) as DocRow[];
  }

  return docList;
}

/**
 * Lädt Dokumente anhand von IDs (für KI-Anfrage mit fest gewählter Liste).
 */
export async function getDocumentsByIds(ids: string[], schoolNumber?: string | null): Promise<DocRow[]> {
  const supabase = supabaseServer();
  if (!supabase || ids.length === 0) return [];

  let byIdsQuery = supabase
    .from('documents')
    .select(
      'id, title, document_type_code, created_at, status, reach_scope, participation_groups, review_date, legal_reference, responsible_unit, gremium, summary, search_text, keywords',
    )
    .in('id', ids)
    .in('status', [...WORKFLOW_STATUS_ORDER]);
  if (schoolNumber) byIdsQuery = byIdsQuery.eq('school_number', schoolNumber);
  const { data } = await byIdsQuery;

  const order = new Map(ids.map((id, i) => [id, i]));
  const list = (data ?? []) as DocRow[];
  list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return list;
}
