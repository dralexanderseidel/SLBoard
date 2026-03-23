import { NextRequest, NextResponse } from 'next/server';
import { getDocumentText } from '../../../lib/documentText';
import { callLlm, isLlmConfigured } from '../../../lib/llmClient';
import { supabaseServer } from '../../../lib/supabaseServer';

type SummarizePayload = {
  title?: string;
  type?: string;
  createdAt?: string;
  text?: string;
  documentId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { title, type, createdAt, text, documentId }: SummarizePayload = await req.json();

    let basisText = text ?? '';
    const MAX_SUMMARY_CHARS = 12000;

    // Bei Dokument mit Datei: zuerst Text aus PDF/Word extrahieren, Metadaten nur als Fallback
    if (documentId) {
      const extractedText = await getDocumentText(documentId);
      if (extractedText && extractedText.length > 50) {
        basisText = extractedText;
      }
    }

    // Token-/Context-Schutz: sehr lange Dokumente dürfen das LLM nicht sprengen.
    if (basisText.length > MAX_SUMMARY_CHARS) {
      basisText = basisText.slice(0, MAX_SUMMARY_CHARS) + '…';
    }

    if (!title && !basisText) {
      return NextResponse.json(
        { error: 'Es wurden keine ausreichenden Inhalte für eine Zusammenfassung übergeben.' },
        { status: 400 },
      );
    }

    if (!isLlmConfigured()) {
      return NextResponse.json(
        { error: 'LLM-Umgebungsvariablen sind nicht gesetzt.' },
        { status: 500 },
      );
    }

    const header = [
      title ? `Titel: ${title}` : null,
      type ? `Typ: ${type}` : null,
      createdAt ? `Datum: ${createdAt}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const fullContent = `${header}\n\n${basisText}`.trim();

    const systemPrompt = 'Du bist ein deutscher Assistent für schulische Verwaltungsdokumente.';
    const userPrompt = `
Fasse den folgenden Inhalt in 4–7 klaren, gut lesbaren Sätzen zusammen.
Nenne wichtige Regelungen, Beschlüsse und Zuständigkeiten in neutraler Verwaltungssprache.

Inhalt:
${fullContent}
`.trim();

    const summary = await callLlm(systemPrompt, userPrompt);
    const summaryText = summary || 'Keine Zusammenfassung vom LLM zurückgegeben.';

    // Zusammenfassung in DB speichern, wenn documentId vorhanden
    if (documentId) {
      const supabase = supabaseServer();
      if (supabase) {
        await supabase
          .from('documents')
          .update({ summary: summaryText, summary_updated_at: new Date().toISOString() })
          .eq('id', documentId);
      }
    }

    return NextResponse.json({ summary: summaryText });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Unbekannter Fehler in /api/summarize' },
      { status: 500 },
    );
  }
}

