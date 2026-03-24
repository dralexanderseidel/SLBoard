import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { getUserAccessContext } from '../../../../lib/documentAccess';
import {
  getSuggestedDocuments,
  scoreRelevance,
  extractKeywords,
  type DocRow,
} from '../../../../lib/aiSearch';

const SNIPPET_MAX = 200;

/**
 * POST: Relevante Dokumente zu einer Frage vorschlagen (ohne LLM).
 * Body: { question: string }
 * Return: { suggestedDocuments: { id, title, snippet, score }[] }
 */
export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    }
    const access = await getUserAccessContext(user.email, supabase);

    const { question } = (await req.json()) as { question?: string };
    const trimmed = typeof question === 'string' ? question.trim() : '';

    if (!trimmed) {
      return NextResponse.json(
        { error: 'Bitte geben Sie eine Frage oder Suchbegriffe ein.' },
        { status: 400 },
      );
    }

    const keywords = extractKeywords(trimmed);
    const docList = await getSuggestedDocuments(trimmed, access.schoolNumber);

    const suggestedDocuments = docList.map((doc: DocRow) => {
      const score = scoreRelevance(doc, keywords);
      const summary = (doc.summary ?? '').trim();
      const legalRef = (doc.legal_reference ?? '').trim();
      const snippetSource = summary.length > 30 ? summary : legalRef;
      const snippet =
        snippetSource.length > SNIPPET_MAX
          ? snippetSource.slice(0, SNIPPET_MAX) + '…'
          : snippetSource || '—';

      return {
        id: doc.id,
        title: doc.title,
        snippet: snippet || '—',
        score,
      };
    });

    return NextResponse.json({ suggestedDocuments });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
