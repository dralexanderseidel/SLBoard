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
    const lower = chunk.toLowerCase();
    let score = 0;

    for (const k of kw) {
      if (!lower.includes(k)) continue;
      const occurrences = countKeywordOccurrences(lower, k);
      // 1 point for hit + small weight for multiple occurrences.
      score += 1 + Math.min(2, occurrences - 1) * 0.5;
    }

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

