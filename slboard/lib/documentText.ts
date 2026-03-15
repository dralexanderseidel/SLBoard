/**
 * Text aus Dokumenten extrahieren (PDF, Word, Metadaten).
 */
import mammoth from 'mammoth';
import { supabaseServer } from './supabaseServer';
import { PDFParse } from 'pdf-parse';

const WORD_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
];

function isWordDocument(mimeType: string): boolean {
  return WORD_MIME_TYPES.includes(mimeType);
}

async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const textResult = await parser.getText();
      await parser.destroy();
      return textResult?.text?.trim() ?? null;
    } catch {
      await parser.destroy().catch(() => {});
      return null;
    }
  }

  if (isWordDocument(mimeType)) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const t = result.value?.trim();
      return t && t.length > 0 ? t : null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function getDocumentText(documentId: string): Promise<string | null> {
  const supabase = supabaseServer();
  if (!supabase) return null;

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, title, legal_reference, current_version_id')
    .eq('id', documentId)
    .single();

  if (docError || !doc) return null;

  let text = (doc.legal_reference as string)?.trim() ?? '';

  if (!text && doc.current_version_id) {
    const { data: ver, error: verError } = await supabase
      .from('document_versions')
      .select('file_uri, mime_type')
      .eq('id', doc.current_version_id)
      .single();

    if (!verError && ver?.file_uri) {
      const mimeType = ver.mime_type ?? 'application/octet-stream';
      const isPdf = mimeType === 'application/pdf';
      const isWord = isWordDocument(mimeType);

      if (isPdf || isWord) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(ver.file_uri);

        if (!downloadError && fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          const extracted = await extractTextFromBuffer(buffer, mimeType);
          if (extracted) text = extracted;
        }
      }
    }
  }

  return text && text.length > 0 ? text : null;
}
