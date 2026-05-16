export type ChunkingOptions = {
  chunkChars: number;
  overlapChars: number;
  maxChunks: number;
};

const SEP = '\n\n';

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

export function chunkTextByParagraphs(text: string, opts: ChunkingOptions): string[] {
  const cleaned = normalizeText(text);
  if (!cleaned) return [];

  const chunkChars = Math.max(200, Math.floor(opts.chunkChars));
  const overlapChars = Math.max(0, Math.floor(opts.overlapChars));

  // Absätze: leere Zeile(n) als Trenner.
  const paragraphs = cleaned
    .split(/\n\s*\n+/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [];
  if (paragraphs.length === 1) return [paragraphs[0]];

  // Safety: nicht unendlich viele Chunks erzeugen.
  const maxTotalChunks = Math.max(1, Math.floor(opts.maxChunks * 6));

  const chunks: string[] = [];

  const sepLen = SEP.length;

  let start = 0;
  while (start < paragraphs.length && chunks.length < maxTotalChunks) {
    let end = start;
    let len = 0;

    while (end < paragraphs.length) {
      const p = paragraphs[end] ?? '';
      const candidateLen = len + (end > start ? sepLen : 0) + p.length;
      if (end > start && candidateLen > chunkChars) break;

      len = candidateLen;
      end += 1;
      // Stop, sobald wir genug Länge erreicht haben.
      if (len >= chunkChars) break;
    }

    const chunkText = paragraphs
      .slice(start, end)
      .join(SEP)
      .trim();

    if (chunkText) chunks.push(chunkText);

    if (end >= paragraphs.length) break;
    if (end <= start) {
      // Fallback gegen Endlosschleife.
      start += 1;
      continue;
    }

    if (overlapChars <= 0) {
      start = end;
      continue;
    }

    // Paragraph-Overlap: vom Chunk-Ende rückwärts so viele Absätze einschließen,
    // dass die OverlapChars grob erreicht werden.
    let overlapLen = 0;
    let overlapStart = end - 1;
    while (overlapStart >= start && overlapLen < overlapChars) {
      overlapLen += paragraphs[overlapStart]?.length ?? 0;
      if (overlapStart < end - 1) overlapLen += sepLen;
      overlapStart -= 1;
    }

    const nextStart = overlapStart + 1;
    start = nextStart > start ? nextStart : start + 1;
  }

  return chunks;
}

function countKeywordOccurrences(haystackLower: string, keywordLower: string): number {
  // Naive occurrence count (MVP): good enough for short keyword lists.
  let count = 0;
  let fromIndex = 0;
  while (true) {
    const idx = haystackLower.indexOf(keywordLower, fromIndex);
    if (idx === -1) break;
    count += 1;
    fromIndex = idx + Math.max(1, keywordLower.length);
    if (count > 8) break; // cap to keep scoring cheap
  }
  return count;
}

/** Gleiche Bewertung wie bei pickTopChunksForQuestion (Keyword-Treffer im Chunk). */
export function scoreChunkForKeywords(chunk: string, keywordsLower: string[]): number {
  const lower = chunk.toLowerCase();
  let score = 0;
  for (const k of keywordsLower) {
    if (!k.length || !lower.includes(k)) continue;
    const occurrences = countKeywordOccurrences(lower, k);
    score += 1 + Math.min(2, occurrences - 1) * 0.5;
  }
  return score;
}

/**
 * Ein Chunk mit der höchsten Übereinstimmung zur Frage (Keywords) — für UI-Textbelege.
 * Abweichend vom Prompt-Kontext: dort werden Top-Chunks in Lesereihenfolge zusammengefügt.
 */
export function pickBestEvidenceChunkForQuestion(
  text: string,
  keywords: string[],
  opts: ChunkingOptions
): string | null {
  const cleaned = text.trim();
  if (!cleaned) return null;
  const chunks = chunkTextByParagraphs(cleaned, opts);
  if (chunks.length === 0) return null;
  const kw = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (kw.length === 0) return chunks[0] ?? null;

  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < chunks.length; i++) {
    const s = scoreChunkForKeywords(chunks[i]!, kw);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  if (bestScore <= 0) return chunks[0] ?? null;
  return chunks[bestIdx] ?? null;
}

export function pickTopChunksForQuestion(text: string, keywords: string[], opts: ChunkingOptions): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const chunks = chunkTextByParagraphs(cleaned, opts);
  if (chunks.length === 0) return [];

  const maxChunks = Math.max(1, Math.floor(opts.maxChunks));
  const kw = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);

  // If we don't have keywords, fallback to the first chunks.
  if (kw.length === 0) return chunks.slice(0, maxChunks);

  const scored = chunks.map((chunk, idx) => {
    const score = scoreChunkForKeywords(chunk, kw);
    return { idx, chunk, score };
  });

  // Top chunks by score; then sort by original order for better readability in the prompt.
  scored.sort((a, b) => b.score - a.score);
  const selectedByScore = scored.filter((s) => s.score > 0).slice(0, maxChunks);

  if (selectedByScore.length === 0) {
    return chunks.slice(0, maxChunks);
  }

  selectedByScore.sort((a, b) => a.idx - b.idx);
  return selectedByScore.map((s) => s.chunk);
}

/** Max. Länge für UI-Textbelege unter „Verwendete Dokumente“. */
export const SOURCE_EVIDENCE_MAX_CHARS = 220;

/** Mindestlänge nach Normalisierung; darunter kein Anzeige-Beleg. */
export const SOURCE_EVIDENCE_MIN_CHARS = 12;

export function formatSourceEvidenceExcerpt(text: string | null | undefined): string {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (t.length < SOURCE_EVIDENCE_MIN_CHARS) return '';
  return t.length > SOURCE_EVIDENCE_MAX_CHARS
    ? `${t.slice(0, SOURCE_EVIDENCE_MAX_CHARS)}…`
    : t;
}

/** Bester Beleg aus bereits für die KI gewählten Chunks (gleiche Textbasis wie der Prompt). */
export function pickBestEvidenceFromChunks(chunks: string[], keywords: string[]): string | null {
  if (chunks.length === 0) return null;
  const kw = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (kw.length === 0) return chunks[0] ?? null;

  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < chunks.length; i++) {
    const s = scoreChunkForKeywords(chunks[i]!, kw);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  return chunks[bestIdx] ?? chunks[0] ?? null;
}

/**
 * Fragebezogener Auszug für die Quellenliste: bester Keyword-Chunk, sonst Summary/Rechtsgrundlage.
 */
export function buildSourceEvidenceSnippet(
  textForChunking: string | null | undefined,
  keywords: string[],
  opts: ChunkingOptions,
  fallbacks?: { summary?: string | null; legalReference?: string | null },
): string {
  const cleaned = (textForChunking ?? '').trim();
  if (cleaned.length > SOURCE_EVIDENCE_MIN_CHARS) {
    const chunk = pickBestEvidenceChunkForQuestion(cleaned, keywords, opts);
    const excerpt = formatSourceEvidenceExcerpt(chunk);
    if (excerpt) return excerpt;
    const head = formatSourceEvidenceExcerpt(
      cleaned.slice(0, SOURCE_EVIDENCE_MAX_CHARS + 80),
    );
    if (head) return head;
  }
  const fromSummary = formatSourceEvidenceExcerpt((fallbacks?.summary ?? '').trim());
  if (fromSummary) return fromSummary;
  return formatSourceEvidenceExcerpt((fallbacks?.legalReference ?? '').trim());
}

export type ResolveSourceEvidenceInput = {
  textForChunking: string | null | undefined;
  keywords: string[];
  chunkParams: ChunkingOptions;
  /** Chunks, die in den KI-Prompt eingeflossen sind. */
  promptChunks: string[];
  /** Fertiger Prompt-Auszug (Fallback). */
  promptSnippet: string;
  fallbacks?: { summary?: string | null; legalReference?: string | null };
};

/**
 * UI-Textbeleg: zuerst aus Prompt-Chunks (sicher belegbar), dann Volltext/Summary, zuletzt Prompt-Auszug.
 */
export function resolveSourceEvidenceExcerpt(input: ResolveSourceEvidenceInput): string {
  const { keywords, chunkParams, promptChunks, promptSnippet, fallbacks } = input;

  if (promptChunks.length > 0) {
    const fromPromptChunks = formatSourceEvidenceExcerpt(
      pickBestEvidenceFromChunks(promptChunks, keywords),
    );
    if (fromPromptChunks) return fromPromptChunks;
  }

  const fromText = buildSourceEvidenceSnippet(
    input.textForChunking,
    keywords,
    chunkParams,
    fallbacks,
  );
  if (fromText) return fromText;

  const snippet = (promptSnippet ?? '').trim();
  if (snippet.length > SOURCE_EVIDENCE_MIN_CHARS && !snippet.startsWith('(Kein')) {
    return formatSourceEvidenceExcerpt(snippet);
  }

  return '';
}

export function buildPromptSnippetFromChunks(chunks: string[], maxChars: number): string {
  const limit = Math.max(200, Math.floor(maxChars));
  let out = '';

  for (const chunk of chunks) {
    if (!chunk) continue;
    const sep = out ? '\n\n' : '';
    const candidate = `${out}${sep}${chunk}`;
    if (candidate.length <= limit) {
      out = candidate;
      continue;
    }

    const remaining = limit - out.length - sep.length;
    if (remaining > 0) {
      out = `${out}${sep}${chunk.slice(0, remaining)}…`;
    }
    break;
  }

  return out.trim();
}

