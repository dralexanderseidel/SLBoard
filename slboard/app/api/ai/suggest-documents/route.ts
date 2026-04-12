import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { resolveUserAccess } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';
import {
  getSuggestedDocuments,
  getDocumentsByIds,
  scoreRelevance,
  extractKeywords,
  MAX_DOCS,
  type DocRow,
} from '../../../../lib/aiSearch';

const SNIPPET_MAX = 200;
const MAX_RESULTS_API = 50;

type SuggestBody = {
  question?: string;
  maxResults?: number;
  documentTypeCode?: string | null;
  /** IDs, die in der Liste erscheinen sollen (z. B. ?sourceId=), sofern lesbar */
  ensureIds?: string[];
  /** false = kein „neueste Dokumente“-Fallback ohne Suchtext/Typ (Entwurfsassistent) */
  allowBrowseFallback?: boolean;
};

/**
 * POST: Relevante Dokumente zu einer Frage vorschlagen (ohne LLM).
 * Body: { question?: string, maxResults?: number, documentTypeCode?: string, ensureIds?: string[] }
 * — question leer = „neueste lesbare“ wie Fallback im Dashboard.
 * Return: suggestedDocuments: { id, title, snippet, score, document_type_code?, created_at? }[]
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
    const access = await resolveUserAccess(user.email, supabase);

    const body = (await req.json()) as SuggestBody;
    const trimmed = typeof body.question === 'string' ? body.question.trim() : '';
    const rawMax = typeof body.maxResults === 'number' && Number.isFinite(body.maxResults)
      ? Math.floor(body.maxResults)
      : MAX_DOCS;
    const maxDocs = Math.min(Math.max(rawMax, 1), MAX_RESULTS_API);
    const docType =
      typeof body.documentTypeCode === 'string' && body.documentTypeCode.trim()
        ? body.documentTypeCode.trim()
        : null;
    const ensureIds = Array.isArray(body.ensureIds)
      ? body.ensureIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    const allowBrowseFallback = body.allowBrowseFallback !== false;

    let docList = await getSuggestedDocuments(trimmed, access, {
      maxResults: maxDocs,
      documentTypeCode: docType,
      allowBrowseFallback,
    });

    const inList = new Set(docList.map((d) => d.id));
    const missingEnsure = ensureIds.filter((id) => !inList.has(id));
    if (missingEnsure.length > 0) {
      const extras = await getDocumentsByIds(missingEnsure, access);
      const rank = new Map(missingEnsure.map((id, i) => [id, i]));
      extras.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
      docList = [...extras, ...docList];
    }

    const seen = new Set<string>();
    docList = docList.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
    docList = docList.slice(0, maxDocs);

    const keywords = extractKeywords(trimmed);

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
        document_type_code: doc.document_type_code,
        created_at: doc.created_at,
      };
    });

    return NextResponse.json({ suggestedDocuments });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
