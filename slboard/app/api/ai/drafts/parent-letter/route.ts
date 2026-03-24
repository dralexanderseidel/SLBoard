import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { getDocumentText } from '../../../../../lib/documentText';
import { callLlm, isLlmConfigured } from '../../../../../lib/llmClient';
import { getUserAccessContext } from '../../../../../lib/documentAccess';

type Payload = {
  topic?: string;
  targetAudience?: string;
  purpose?: string;
  sourceIds?: string[];
};

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    const { topic, targetAudience, purpose, sourceIds }: Payload = await req.json();

    if (!topic?.trim()) {
      return NextResponse.json(
        { error: 'Thema/Betreff ist erforderlich.' },
        { status: 400 },
      );
    }

    if (!isLlmConfigured()) {
      return NextResponse.json(
        { error: 'LLM-Umgebungsvariablen sind nicht gesetzt.' },
        { status: 500 },
      );
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase-Service nicht verfügbar.' },
        { status: 500 },
      );
    }

    const access = await getUserAccessContext(user.email, supabase);

    let docsToUse: { id: string; title: string }[] = [];

    if (sourceIds && sourceIds.length > 0) {
      let selectedDocsQuery = supabase
        .from('documents')
        .select('id, title')
        .in('id', sourceIds);
      if (access.schoolNumber) selectedDocsQuery = selectedDocsQuery.eq('school_number', access.schoolNumber);
      const { data } = await selectedDocsQuery;
      docsToUse = (data ?? []).map((d) => ({ id: d.id, title: d.title }));
    }

    if (docsToUse.length === 0) {
      let fallbackDocsQuery = supabase
        .from('documents')
        .select('id, title')
        .eq('document_type_code', 'ELTERNBRIEF')
        .in('status', ['FREIGEGEBEN', 'VEROEFFENTLICHT'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (access.schoolNumber) fallbackDocsQuery = fallbackDocsQuery.eq('school_number', access.schoolNumber);
      const { data } = await fallbackDocsQuery;
      docsToUse = (data ?? []).map((d) => ({ id: d.id, title: d.title }));
    }

    const sourceTexts: { id: string; title: string; text: string }[] = [];
    for (const doc of docsToUse) {
      const text = await getDocumentText(doc.id);
      if (text && text.length > 50) {
        sourceTexts.push({ id: doc.id, title: doc.title, text });
      }
    }

    const vorlagenBlock =
      sourceTexts.length > 0
        ? sourceTexts
            .map(
              (s) =>
                `--- Vorlage: ${s.title} ---\n${s.text.slice(0, 4000)}${s.text.length > 4000 ? '...' : ''}`,
            )
            .join('\n\n')
        : 'Es stehen keine Vorlagen zur Verfügung. Erstelle einen allgemeinen Entwurf.';

    const systemPrompt = `Du bist ein deutscher Assistent für schulische Verwaltungsdokumente.
Erstelle Entwürfe für Elternbriefe in sachlichem, freundlichem Ton.
Antworte NUR mit dem geforderten Format, ohne zusätzliche Erklärungen.`;

    const userPrompt = `Erstelle einen Entwurf für einen Elternbrief.

Thema/Betreff: ${topic}
Zielgruppe: ${targetAudience || 'Eltern'}
Zweck/Kontext: ${purpose || 'Information'}

Nutze folgende Vorlagen als Inspiration (Stil, Formulierungen):

${vorlagenBlock}

Antworte ausschließlich in diesem Format (keine anderen Zeichen davor oder danach):

BETREFF:
[Dein Vorschlag für den Betreff, eine Zeile]

TEXT:
[Dein Vorschlag für den Entwurfstext, mit Anrede und Grußformel]`;

    const rawResponse = await callLlm(systemPrompt, userPrompt);

    let suggestedTitle = topic;
    let body = rawResponse;

    const betrefMatch = rawResponse.match(/BETREFF:\s*\n([^\n]+)/i);
    const textMatch = rawResponse.match(/TEXT:\s*\n([\s\S]+?)(?=\n\n[A-Z]+:|$)/i);

    if (betrefMatch) suggestedTitle = betrefMatch[1].trim();
    if (textMatch) body = textMatch[1].trim();

    return NextResponse.json({
      suggestedTitle,
      body,
      sources: docsToUse.map((d) => ({ documentId: d.id, title: d.title })),
      disclaimer: 'Entwurf zur Prüfung. Nicht automatisch versenden.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
