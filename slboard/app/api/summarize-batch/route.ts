import { NextRequest, NextResponse } from 'next/server';
import { getDocumentText } from '../../../lib/documentText';
import { callLlm, isLlmConfigured } from '../../../lib/llmClient';
import { supabaseServer } from '../../../lib/supabaseServer';

type SummarizeBatchPayload = {
  documentIds: string[];
};

const systemPrompt = 'Du bist ein deutscher Assistent für schulische Verwaltungsdokumente.';

export async function POST(req: NextRequest) {
  try {
    const { documentIds }: SummarizeBatchPayload = await req.json();

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Keine documentIds übergeben.' }, { status: 400 });
    }

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: 'LLM-Umgebungsvariablen sind nicht gesetzt.' }, { status: 500 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    }

    const uniqueIds = Array.from(new Set(documentIds.filter((id) => typeof id === 'string' && id.trim().length > 0)));

    const MAX_SUMMARY_CHARS = 12000;

    const results: Array<{ documentId: string; ok: boolean; error?: string }> = [];
    let okCount = 0;

    for (const documentId of uniqueIds) {
      try {
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .select('id, title, document_type_code, created_at')
          .eq('id', documentId)
          .single();

        if (docError || !doc) throw new Error('Dokument nicht gefunden.');

        const extractedText = await getDocumentText(documentId);
        let basisText = extractedText && extractedText.length > 50 ? extractedText : '';

        if (basisText.length > MAX_SUMMARY_CHARS) {
          basisText = basisText.slice(0, MAX_SUMMARY_CHARS) + '…';
        }

        if (!doc.title && !basisText) {
          throw new Error('Nicht ausreichend Inhalte für eine Zusammenfassung.');
        }

        const header = [
          doc.title ? `Titel: ${doc.title}` : null,
          doc.document_type_code ? `Typ: ${doc.document_type_code}` : null,
          doc.created_at ? `Datum: ${doc.created_at}` : null,
        ]
          .filter(Boolean)
          .join(' · ');

        const fullContent = `${header}\n\n${basisText}`.trim();
        const userPrompt = `
Fasse den folgenden Inhalt in 4–7 klaren, gut lesbaren Sätzen zusammen.
Nenne wichtige Regelungen, Beschlüsse und Zuständigkeiten in neutraler Verwaltungssprache.

Inhalt:
${fullContent}
`.trim();

        const summary = await callLlm(systemPrompt, userPrompt);
        const summaryText = summary || 'Keine Zusammenfassung vom LLM zurückgegeben.';

        await supabase
          .from('documents')
          .update({ summary: summaryText, summary_updated_at: new Date().toISOString() })
          .eq('id', documentId);

        okCount += 1;
        results.push({ documentId, ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unbekannter Fehler beim Summarize.';
        results.push({ documentId, ok: false, error: message });
      }
    }

    const failCount = uniqueIds.length - okCount;
    return NextResponse.json({ okCount, failCount, results });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Unbekannter Fehler in /api/summarize-batch' },
      { status: 500 },
    );
  }
}

