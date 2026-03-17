export type IndexInput = {
  title: string;
  documentType?: string | null;
  gremium?: string | null;
  responsibleUnit?: string | null;
  summary?: string | null;
  legalReference?: string | null;
  extractedText?: string | null;
};

export type IndexResult = {
  keywords: string[];
  searchText: string;
};

const STOP_WORDS = new Set([
  'und', 'oder', 'der', 'die', 'das', 'ein', 'eine', 'bei', 'von', 'zu', 'zur', 'mit', 'für',
  'auf', 'ist', 'sind', 'wird', 'werden', 'hat', 'haben', 'kann', 'können', 'soll', 'sollen',
  'was', 'wie', 'welche', 'welcher', 'wann', 'wo', 'warum', 'wer',
  'im', 'in', 'am', 'an', 'aus', 'als', 'auch', 'nicht', 'nur', 'dass', 'dem', 'den', 'des',
  'einer', 'eines', 'einem', 'zur', 'zum', 'bei', 'für', 'über', 'unter',
]);

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\wäöüß\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(input: string): string[] {
  const norm = normalizeText(input);
  if (!norm) return [];
  return norm
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function topKeywordsFromText(text: string, max: number): string[] {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    // Zahlen-/Datumsmuster grob vermeiden
    if (/^\d{2,}$/.test(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

/**
 * Phase A Index: Keywords + search_text ohne KI.
 * - Keywords: simple Frequenz-basierte Schlagwörter aus extractedText/summary/legalReference
 * - searchText: Titel + Metadaten + Keywords + kurzer Textauszug (max chars)
 */
export function buildSearchIndex(input: IndexInput): IndexResult {
  const title = (input.title ?? '').trim();
  const metaParts = [
    title,
    (input.documentType ?? '').trim(),
    (input.gremium ?? '').trim(),
    (input.responsibleUnit ?? '').trim(),
  ].filter(Boolean);

  const basisText =
    (input.extractedText ?? '').trim() ||
    (input.summary ?? '').trim() ||
    (input.legalReference ?? '').trim();

  const keywords = basisText ? topKeywordsFromText(basisText, 25) : [];
  const excerptMax = 5000;
  const excerpt = basisText ? basisText.slice(0, excerptMax) : '';

  const searchText = [
    ...metaParts,
    keywords.length ? keywords.join(' ') : '',
    excerpt,
  ]
    .filter((p) => p && p.trim())
    .join('\n')
    .slice(0, 30000); // harte Grenze, damit search_text nicht explodiert

  return { keywords, searchText };
}

