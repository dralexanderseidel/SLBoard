/**
 * Gemeinsame Suchlogik für KI: Keyword-Extraktion, Relevanz-Score, Dokumentenliste.
 */
import { supabaseServer } from './supabaseServer';
import { WORKFLOW_STATUS_ORDER, statusLabelDe } from './documentWorkflow';
import {
  canAccessSchool,
  canReadDocument,
  type UserAccessContext,
} from './documentAccess';

export const MAX_DOCS = 10;

/** Größerer Pool vor Leserechte-Filter, damit genug Treffer übrig bleiben. */
const SEARCH_POOL_BEFORE_FILTER = 100;
const FALLBACK_POOL_BEFORE_FILTER = 48;

const MAX_RESULTS_CAP = 50;

export type SuggestedDocumentsOptions = {
  /** Standard: MAX_DOCS (10), z. B. Entwurfsassistent: 20 */
  maxResults?: number;
  /** Wenn gesetzt: nur dieser document_type_code */
  documentTypeCode?: string | null;
  /**
   * false: keine „Stöbern“-Fallback-Liste (neueste lesbare), wenn keine Suchbegriffe.
   * true (Standard): wie bisher; mit documentTypeCode ohne Text trotzdem nach Typ stöbern.
   */
  allowBrowseFallback?: boolean;
};

function clampMaxResults(n: number | undefined): number {
  const v = n ?? MAX_DOCS;
  return Math.min(Math.max(v, 1), MAX_RESULTS_CAP);
}

function filterDocsByReadAccess(access: UserAccessContext, rows: DocRow[]): DocRow[] {
  return rows.filter((d) =>
    canAccessSchool(access, d.school_number ?? null) &&
    canReadDocument(access, d.protection_class_id ?? null, d.responsible_unit ?? null),
  );
}

import { STOP_WORDS } from './indexing';
import { schulentwicklungFieldLabelDe } from './steeringAnalysisV2';

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

/** Volltext für Phrasen-ilike: keine Zeichen, die PostgREST-.or() zerlegen oder LIKE wildcards triggern. */
function sanitizeForPhraseIlike(q: string): string {
  return q
    .replace(/,/g, ' ')
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** Relevanz-Score: extrahierte Keywords oder einzelne Wörter (≥2) aus der Phrase. */
function keywordsForScoring(question: string): string[] {
  const fromExtract = extractKeywords(question);
  if (fromExtract.length > 0) return fromExtract;
  const safe = sanitizeForPhraseIlike(question);
  const words = safe
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  return [...new Set(words)];
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
  protection_class_id?: number | null;
  school_number?: string | null;
  gremium: string | null;
  reach_scope?: 'intern' | 'extern' | null;
  participation_groups?: string[] | null;
  review_date?: string | null;
  summary: string | null;
  search_text?: string | null;
  keywords?: string[] | null;
  /** Denormalisiert aus Steuerungsanalyse; Kontext für KI-Prompts */
  schulentwicklung_primary_field?: string | null;
  schulentwicklung_fields?: string[] | null;
};

/**
 * Deutscher Textblock mit Dokumentmetadaten für KI-QA (Gremium, Status, Fristen, …).
 */
export function buildDocumentMetadataPromptSection(doc: DocRow): string {
  const lines: string[] = [
    'Metadaten (verbindlich für Fragen zu Gremium, Status, Reichweite, Evaluation/Wiedervorlage, Verantwortung, Schulentwicklungs-Zuordnung):',
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
  if (rd) lines.push(`- Evaluation/Wiedervorlage: ${rd}`);
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
  const swPrimary = doc.schulentwicklung_primary_field?.trim() ?? '';
  const swFieldsRaw = Array.isArray(doc.schulentwicklung_fields)
    ? doc.schulentwicklung_fields.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const swFields = swFieldsRaw.length > 0 ? swFieldsRaw : swPrimary ? [swPrimary] : [];
  if (swPrimary || swFields.length > 0) {
    const primaryLabel = swPrimary
      ? schulentwicklungFieldLabelDe(swPrimary)
      : swFields[0]
        ? schulentwicklungFieldLabelDe(swFields[0])
        : '—';
    const fieldLabels = swFields.map((c) => schulentwicklungFieldLabelDe(c)).join(', ');
    lines.push(
      `- Schulentwicklung (Metadaten, letzte KI-Zuordnung): Primär: ${primaryLabel}; zugeordnete Aufgabenfelder: ${fieldLabels}`,
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

const DOC_SELECT_FOR_SEARCH =
  'id, title, document_type_code, created_at, status, reach_scope, participation_groups, review_date, legal_reference, responsible_unit, protection_class_id, school_number, gremium, summary, search_text, keywords, schulentwicklung_primary_field, schulentwicklung_fields';

/**
 * Sucht Dokumente nach Frage (Keywords), sortiert nach Relevanz. Kein LLM.
 * Ergebnisse sind auf vom Nutzer lesbare Dokumente begrenzt (Schutzstufe / Rollen).
 */
export async function getSuggestedDocuments(
  question: string,
  access: UserAccessContext,
  options?: SuggestedDocumentsOptions,
): Promise<DocRow[]> {
  const supabase = supabaseServer();
  if (!supabase) return [];

  const maxDocs = clampMaxResults(options?.maxResults);
  const docType = options?.documentTypeCode?.trim() || null;
  const allowBrowseFallback = options?.allowBrowseFallback ?? true;

  const schoolNumber = access.schoolNumber;
  const trimmedQ = question.trim();
  const hasSearchIntent = trimmedQ.length > 0;
  const keywords = extractKeywords(question);
  let docList: DocRow[] = [];

  const runPhraseSearch = async (): Promise<DocRow[]> => {
    const safe = sanitizeForPhraseIlike(trimmedQ);
    if (safe.length < 2) return [];
    const pattern = `%${safe}%`;
    const orParts = [
      `title.ilike.${pattern}`,
      `search_text.ilike.${pattern}`,
      `summary.ilike.${pattern}`,
      `legal_reference.ilike.${pattern}`,
    ];
    let phraseQuery = supabase
      .from('documents')
      .select(DOC_SELECT_FOR_SEARCH)
      .is('archived_at', null)
      .in('status', [...WORKFLOW_STATUS_ORDER])
      .or(orParts.join(','))
      .order('created_at', { ascending: false })
      .limit(SEARCH_POOL_BEFORE_FILTER);
    if (schoolNumber) phraseQuery = phraseQuery.eq('school_number', schoolNumber);
    if (docType) phraseQuery = phraseQuery.eq('document_type_code', docType);
    const { data: phraseRows } = await phraseQuery;
    let typed = filterDocsByReadAccess(access, (phraseRows ?? []) as DocRow[]);
    if (typed.length === 0) return [];
    const kwScore = keywordsForScoring(trimmedQ);
    typed.sort((a, b) => scoreRelevance(b, kwScore) - scoreRelevance(a, kwScore));
    return typed.slice(0, maxDocs);
  };

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
      .select(DOC_SELECT_FOR_SEARCH)
      .is('archived_at', null)
      .in('status', [...WORKFLOW_STATUS_ORDER])
      .or(orParts.join(','))
      .order('created_at', { ascending: false })
      .limit(SEARCH_POOL_BEFORE_FILTER);
    if (schoolNumber) relevantQuery = relevantQuery.eq('school_number', schoolNumber);
    if (docType) relevantQuery = relevantQuery.eq('document_type_code', docType);
    const { data: relevant } = await relevantQuery;
    let typed = filterDocsByReadAccess(access, (relevant ?? []) as DocRow[]);
    if (typed.length === 0) {
      docList = await runPhraseSearch();
    } else {
      typed.sort((a, b) => scoreRelevance(b, keywords) - scoreRelevance(a, keywords));
      docList = typed.slice(0, maxDocs);
    }
  } else if (hasSearchIntent) {
    docList = await runPhraseSearch();
  }

  if (docList.length === 0) {
    if (!allowBrowseFallback && !docType) {
      return [];
    }
    let fallbackQuery = supabase
      .from('documents')
      .select(DOC_SELECT_FOR_SEARCH)
      .is('archived_at', null)
      .in('status', [...WORKFLOW_STATUS_ORDER])
      .order('created_at', { ascending: false })
      .limit(FALLBACK_POOL_BEFORE_FILTER);
    if (schoolNumber) fallbackQuery = fallbackQuery.eq('school_number', schoolNumber);
    if (docType) fallbackQuery = fallbackQuery.eq('document_type_code', docType);
    const { data: fallback } = await fallbackQuery;
    docList = filterDocsByReadAccess(access, (fallback ?? []) as DocRow[]).slice(0, maxDocs);
  }

  return docList;
}

/**
 * Lädt Dokumente anhand von IDs (für KI-Anfrage mit fest gewählter Liste).
 * Nur Einträge, die der Nutzer lesen darf.
 */
export async function getDocumentsByIds(ids: string[], access: UserAccessContext): Promise<DocRow[]> {
  const supabase = supabaseServer();
  if (!supabase || ids.length === 0) return [];

  const schoolNumber = access.schoolNumber;
  let byIdsQuery = supabase
    .from('documents')
    .select(DOC_SELECT_FOR_SEARCH)
    .in('id', ids)
    .in('status', [...WORKFLOW_STATUS_ORDER]);
  if (schoolNumber) byIdsQuery = byIdsQuery.eq('school_number', schoolNumber);
  const { data } = await byIdsQuery;

  const allowed = new Set(
    filterDocsByReadAccess(access, (data ?? []) as DocRow[]).map((d) => d.id),
  );
  const order = new Map(ids.map((id, i) => [id, i]));
  const list = (data ?? [])
    .filter((row) => allowed.has((row as DocRow).id))
    .map((row) => row as DocRow);
  list.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return list;
}
