import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { resolveUserAccess } from '../../../../../lib/documentAccess';
import { normalizeAuthEmail } from '../../../../../lib/authEmail';
import { apiError } from '../../../../../lib/apiError';
import {
  assertDocumentReadableForComments,
  fetchActiveCommentsForDocument,
  normalizeCommentBody,
  serializeCommentForApi,
  type DocumentCommentRow,
} from '../../../../../lib/documentCommentsServer';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id: documentId } = await params;
    const access = await resolveUserAccess(user.email, supabase);
    const gate = await assertDocumentReadableForComments(supabase, documentId, user.email, access);
    if (!gate.ok) {
      return apiError(gate.status, gate.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', gate.message);
    }

    const rows = await fetchActiveCommentsForDocument(supabase, documentId, gate.doc.school_number);
    return NextResponse.json({ comments: rows.map(serializeCommentForApi) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id: documentId } = await params;
    const access = await resolveUserAccess(user.email, supabase);
    if (!access.hasAppUser || !access.appUserId || !access.schoolNumber) {
      return apiError(403, 'FORBIDDEN', 'Kein Schul-Konto für Kommentare.');
    }

    const gate = await assertDocumentReadableForComments(supabase, documentId, user.email, access);
    if (!gate.ok) {
      return apiError(gate.status, gate.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', gate.message);
    }

    if (!access.schoolNumber) {
      return apiError(403, 'FORBIDDEN', 'Kein Schul-Kontext für Kommentare.');
    }
    if (gate.doc.school_number && gate.doc.school_number !== access.schoolNumber) {
      return apiError(403, 'FORBIDDEN', 'Schulkontext passt nicht zum Dokument.');
    }
    const sn = gate.doc.school_number ?? access.schoolNumber;

    const payload = (await req.json().catch(() => ({}))) as { body?: string };
    const normalized = normalizeCommentBody(String(payload.body ?? ''));
    if (!normalized.ok) {
      return apiError(400, 'VALIDATION_ERROR', normalized.message);
    }

    const { data: authorRow } = await supabase
      .from('app_users')
      .select('full_name, username, email')
      .eq('id', access.appUserId)
      .maybeSingle();
    const au = authorRow as { full_name?: string | null; username?: string | null; email?: string | null } | null;
    const authorLabel =
      (au?.full_name?.trim() || au?.username?.trim() || au?.email?.trim() || user.email).trim() ||
      normalizeAuthEmail(user.email);

    const { data: inserted, error: insErr } = await supabase
      .from('document_comments')
      .insert({
        document_id: documentId,
        school_number: sn,
        author_app_user_id: access.appUserId,
        author_email: normalizeAuthEmail(user.email),
        author_label: authorLabel,
        body: normalized.body,
      })
      .select(
        'id, document_id, school_number, author_app_user_id, author_email, author_label, body, created_at, updated_at, deleted_at',
      )
      .single();

    if (insErr || !inserted) {
      if ((insErr?.message ?? '').toLowerCase().includes('relation') && (insErr?.message ?? '').includes('does not exist')) {
        return apiError(503, 'SERVICE_UNAVAILABLE', 'Kommentar-Funktion noch nicht bereit (Migration fehlt).');
      }
      return apiError(500, 'INTERNAL_ERROR', insErr?.message ?? 'Kommentar konnte nicht gespeichert werden.');
    }

    return NextResponse.json({ comment: serializeCommentForApi(inserted as DocumentCommentRow) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
