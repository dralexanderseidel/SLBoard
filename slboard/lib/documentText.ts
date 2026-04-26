/**
 * Text aus Dokumenten extrahieren (PDF, Word, Metadaten).
 */
import './pdfNodePolyfill';
import mammoth from 'mammoth';
import { supabaseServer } from './supabaseServer';
import { PDFParse, VerbosityLevel } from 'pdf-parse';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WORD_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
];

function isWordDocument(mimeType: string): boolean {
  return WORD_MIME_TYPES.includes(mimeType);
}

function mimeFromFileUri(fileUri: string): string | null {
  const uri = (fileUri ?? '').toLowerCase();
  if (uri.endsWith('.pdf')) return 'application/pdf';
  if (uri.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (uri.endsWith('.doc')) return 'application/msword';
  return null;
}

let pdfWorkerConfigured = false;
let pdfMainThreadWorkerSeeded = false;

type PdfJsWorkerModule = { WorkerMessageHandler?: unknown };

function resolvePdfWorkerPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
    path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/**
 * pdfjs in Node nutzt immer den „Fake Worker“, der sonst `import("./pdf.worker.mjs")` relativ zu `pdf.mjs`
 * ausführt — auf Vercel bricht das oft. Wenn wir `WorkerMessageHandler` vorab per absolutem file-URL-Import
 * unter `globalThis.pdfjsWorker` registrieren, überspringt pdfjs den fehlschlagenden Import.
 */
async function ensurePdfMainThreadWorkerSeeded(): Promise<void> {
  if (pdfMainThreadWorkerSeeded) return;
  const g = globalThis as typeof globalThis & { pdfjsWorker?: PdfJsWorkerModule };
  if (g.pdfjsWorker?.WorkerMessageHandler) {
    pdfMainThreadWorkerSeeded = true;
    return;
  }
  const register = (mod: PdfJsWorkerModule): boolean => {
    const handler = mod?.WorkerMessageHandler;
    if (!handler) return false;
    g.pdfjsWorker = { WorkerMessageHandler: handler };
    pdfMainThreadWorkerSeeded = true;
    return true;
  };
  // Zuerst Paket-Specifier (gleiche Auflösung wie pdf-parse); hilft dem NFT-Trace und Vercel.
  try {
    const mod = (await import(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    )) as PdfJsWorkerModule;
    if (register(mod)) return;
  } catch {
    // z. B. Trace ohne Worker-Datei — file-URL-Fallback
  }
  const workerPath = resolvePdfWorkerPath();
  if (!workerPath) return;
  try {
    const href = pathToFileURL(workerPath).href;
    const mod = (await import(/* webpackIgnore: true */ href)) as PdfJsWorkerModule;
    register(mod);
  } catch {
    // Ohne Handler versucht pdfjs den eingebauten relativen Import (bricht auf Serverless oft ab).
  }
}

/**
 * Standard-Schriften für pdfjs (sonst oft leere Textextraktion auf Serverless, obwohl lokal Text kommt).
 */
function resolveStandardFontDataUrl(): string | undefined {
  const dirs = [
    path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts'),
    path.join(process.cwd(), '..', 'node_modules', 'pdfjs-dist', 'standard_fonts'),
  ];
  for (const dir of dirs) {
    if (existsSync(path.join(dir, 'FoxitSerif.pfb'))) {
      const dirUrl = dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`;
      return pathToFileURL(dirUrl).href;
    }
  }
  return undefined;
}

function basePdfLoadOptions(buffer: Buffer) {
  const standardFontDataUrl = resolveStandardFontDataUrl();
  return {
    data: buffer,
    verbosity: VerbosityLevel.ERRORS,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    disableRange: true,
    disableStream: true,
    ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
  };
}

function ensurePdfWorkerConfigured(): void {
  if (pdfWorkerConfigured) return;
  const workerPath = resolvePdfWorkerPath();
  if (workerPath) {
    const workerSrc = pathToFileURL(workerPath).toString();
    PDFParse.setWorker(workerSrc);
    pdfWorkerConfigured = true;
  }
}

type PdfJsResult = { text: string | null; error: string | null };

async function extractPdfTextWithPdfJs(buffer: Buffer): Promise<PdfJsResult> {
  try {
    await ensurePdfMainThreadWorkerSeeded();
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const workerPath = resolvePdfWorkerPath();
    if (workerPath && (pdfjs as { GlobalWorkerOptions?: { workerSrc?: string } }).GlobalWorkerOptions) {
      (pdfjs as { GlobalWorkerOptions: { workerSrc?: string } }).GlobalWorkerOptions.workerSrc =
        pathToFileURL(workerPath).toString();
    }
    const loadingTask = pdfjs.getDocument({
      ...basePdfLoadOptions(buffer),
      data: new Uint8Array(buffer),
    } as unknown as Parameters<typeof pdfjs.getDocument>[0]);
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = (content.items as Array<{ str?: string }>)
        .map((item) => item?.str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageText.length > 0) {
        pages.push(pageText);
      }
    }
    const merged = pages.join('\n\n').trim();
    return { text: merged.length > 0 ? merged : null, error: null };
  } catch (e) {
    return { text: null, error: e instanceof Error ? e.message : 'pdfjs error' };
  }
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{
  text: string | null;
  method: 'pdf-parse' | 'pdfjs' | 'mammoth' | 'none';
  pdfParseTextLength?: number;
  pdfParsePagesTextLength?: number;
  pdfParseError?: string | null;
  pdfJsTextLength?: number;
  pdfJsError?: string | null;
}> {
  if (mimeType === 'application/pdf') {
    await ensurePdfMainThreadWorkerSeeded();
    ensurePdfWorkerConfigured();
    const parser = new PDFParse(basePdfLoadOptions(buffer));
    let textResult: { text?: string; pages?: Array<{ text?: string }> } | null = null;
    let pdfParseError: string | null = null;
    try {
      textResult = await parser.getText();
    } catch (e) {
      pdfParseError = e instanceof Error ? e.message : 'pdf-parse error';
    } finally {
      // destroy() darf den erfolgreich extrahierten Text nicht mehr "kaputt machen"
      await parser.destroy().catch(() => {});
    }
    const primaryText = textResult?.text?.trim() ?? '';
    if (primaryText.length > 0) {
      return {
        text: primaryText,
        method: 'pdf-parse',
        pdfParseTextLength: primaryText.length,
        pdfParsePagesTextLength: 0,
        pdfParseError,
        pdfJsTextLength: 0,
        pdfJsError: null,
      };
    }

    const pagesText = (textResult?.pages ?? [])
      .map((page) => page?.text?.trim() ?? '')
      .filter(Boolean)
      .join('\n\n')
      .trim();
    if (pagesText.length > 0) {
      return {
        text: pagesText,
        method: 'pdf-parse',
        pdfParseTextLength: primaryText.length,
        pdfParsePagesTextLength: pagesText.length,
        pdfParseError,
        pdfJsTextLength: 0,
        pdfJsError: null,
      };
    }

    const pdfJsResult = await extractPdfTextWithPdfJs(buffer);
    if (pdfJsResult.text) {
      return {
        text: pdfJsResult.text,
        method: 'pdfjs',
        pdfParseTextLength: primaryText.length,
        pdfParsePagesTextLength: pagesText.length,
        pdfParseError,
        pdfJsTextLength: pdfJsResult.text.length,
        pdfJsError: pdfJsResult.error,
      };
    }
    return {
      text: null,
      method: 'none',
      pdfParseTextLength: primaryText.length,
      pdfParsePagesTextLength: pagesText.length,
      pdfParseError,
      pdfJsTextLength: 0,
      pdfJsError: pdfJsResult.error,
    };
  }

  if (isWordDocument(mimeType)) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const t = result.value?.trim();
      return { text: t && t.length > 0 ? t : null, method: t && t.length > 0 ? 'mammoth' : 'none' };
    } catch {
      return { text: null, method: 'none' };
    }
  }

  return { text: null, method: 'none' };
}

export type DocumentTextDiagnostics = {
  documentId: string;
  currentVersionId: string | null;
  fileUri: string | null;
  mimeType: string | null;
  normalizedMime: string | null;
  usedLegalReference: boolean;
  attemptedDownload: boolean;
  downloadError: string | null;
  parserError: string | null;
  textLength: number;
  fileSizeBytes: number | null;
  fileSha256: string | null;
  extractionMethod: 'pdf-parse' | 'pdfjs' | 'mammoth' | 'none';
  pdfParseTextLength: number;
  pdfParsePagesTextLength: number;
  pdfParseError: string | null;
  pdfJsTextLength: number;
  pdfJsError: string | null;
};

export type DocumentTextResult = {
  diagnostics: DocumentTextDiagnostics;
  /** Extrahierter bzw. Metadaten-Text; ein Download/Parse pro Aufruf. */
  text: string | null;
};

function emptyDiagnostics(documentId: string): DocumentTextDiagnostics {
  return {
    documentId,
    currentVersionId: null,
    fileUri: null,
    mimeType: null,
    normalizedMime: null,
    usedLegalReference: false,
    attemptedDownload: false,
    downloadError: null,
    parserError: null,
    textLength: 0,
    fileSizeBytes: null,
    fileSha256: null,
    extractionMethod: 'none',
    pdfParseTextLength: 0,
    pdfParsePagesTextLength: 0,
    pdfParseError: null,
    pdfJsTextLength: 0,
    pdfJsError: null,
  };
}

/**
 * Lädt den Dokumenttext höchstens einmal (Storage + Parser). Nutzen für Diagnose und Volltext.
 */
export async function getDocumentTextWithDiagnostics(documentId: string): Promise<DocumentTextResult> {
  const base = emptyDiagnostics(documentId);
  const supabase = supabaseServer();
  if (!supabase) {
    return { diagnostics: base, text: null };
  }

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, legal_reference, current_version_id')
    .eq('id', documentId)
    .single();

  if (docError || !doc) {
    return { diagnostics: base, text: null };
  }

  base.currentVersionId = (doc.current_version_id as string | null) ?? null;
  const legalRef = (doc.legal_reference as string | null)?.trim() ?? '';
  if (legalRef.length > 0) {
    base.usedLegalReference = true;
    base.textLength = legalRef.length;
    base.extractionMethod = 'none';
    return { diagnostics: base, text: legalRef };
  }

  if (!doc.current_version_id) {
    return { diagnostics: base, text: null };
  }

  const { data: ver, error: verError } = await supabase
    .from('document_versions')
    .select('file_uri, mime_type')
    .eq('id', doc.current_version_id)
    .single();

  if (verError || !ver?.file_uri) {
    base.parserError = verError?.message ?? 'Version oder file_uri nicht gefunden.';
    return { diagnostics: base, text: null };
  }

  const rawMime = (ver.mime_type as string | null) ?? 'application/octet-stream';
  const fileUri = String(ver.file_uri ?? '');
  const fileUriLower = fileUri.toLowerCase();
  const extMime = mimeFromFileUri(fileUriLower);
  const normalizedMime = rawMime === 'application/octet-stream' && extMime ? extMime : rawMime;

  base.fileUri = fileUri;
  base.mimeType = rawMime;
  base.normalizedMime = normalizedMime;

  const isPdf = normalizedMime === 'application/pdf' || fileUriLower.endsWith('.pdf');
  const isWord =
    isWordDocument(normalizedMime) ||
    fileUriLower.endsWith('.docx') ||
    fileUriLower.endsWith('.doc');

  if (!isPdf && !isWord) {
    base.parserError = `Dateityp wird nicht unterstützt: ${normalizedMime}`;
    return { diagnostics: base, text: null };
  }

  base.attemptedDownload = true;
  const { data: fileData, error: downloadError } = await supabase.storage.from('documents').download(fileUri);

  if (downloadError || !fileData) {
    base.downloadError = downloadError?.message ?? 'Datei konnte nicht geladen werden.';
    return { diagnostics: base, text: null };
  }

  try {
    const buffer = Buffer.from(await fileData.arrayBuffer());
    base.fileSizeBytes = buffer.length;
    try {
      const crypto = await import('node:crypto');
      base.fileSha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    } catch {
      // ignore hash errors
    }
    const parserMime = isPdf
      ? 'application/pdf'
      : isWordDocument(normalizedMime)
        ? normalizedMime
        : (extMime ?? normalizedMime);
    const extracted = await extractTextFromBuffer(buffer, parserMime);
    base.extractionMethod = extracted.method;
    const trimmed = extracted.text?.trim() ?? '';
    base.textLength = trimmed.length;
    base.pdfParseTextLength = extracted.pdfParseTextLength ?? 0;
    base.pdfParsePagesTextLength = extracted.pdfParsePagesTextLength ?? 0;
    base.pdfParseError = extracted.pdfParseError ?? null;
    base.pdfJsTextLength = extracted.pdfJsTextLength ?? 0;
    base.pdfJsError = extracted.pdfJsError ?? null;
    return { diagnostics: base, text: trimmed.length > 0 ? trimmed : null };
  } catch (e) {
    base.parserError = e instanceof Error ? e.message : 'Unbekannter Parser-Fehler.';
    return { diagnostics: base, text: null };
  }
}

export async function getDocumentTextDiagnostics(documentId: string): Promise<DocumentTextDiagnostics> {
  const { diagnostics } = await getDocumentTextWithDiagnostics(documentId);
  return diagnostics;
}

export async function getDocumentText(documentId: string): Promise<string | null> {
  const { text } = await getDocumentTextWithDiagnostics(documentId);
  return text;
}
