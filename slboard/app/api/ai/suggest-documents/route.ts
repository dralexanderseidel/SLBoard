import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { getUserAccessContext } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';
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
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }
    const access = await getUserAccessContext(user.email, supabase);

    const { question } = (await req.json()) as { question?: string };
    const trimmed = typeof question === 'string' ? question.trim() : '';

    if (!trimmed) {
      return apiError(400, 'VALIDATION_ERROR', 'Bitte geben Sie eine Frage oder Suchbegriffe ein.');
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
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
