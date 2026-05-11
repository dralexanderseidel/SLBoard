import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../../lib/supabaseServerClient';
import { resolveUserAccess } from '../../../../../../lib/documentAccess';
import { apiError } from '../../../../../../lib/apiError';
import {
  assertDocumentReadableForComments,
  isCommentAuthor,
  normalizeCommentBody,
  serializeCommentForApi,
  type DocumentCommentRow,
} from '../../../../../../lib/documentCommentsServer';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
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

    const { id: documentId, commentId } = await params;
    const access = await resolveUserAccess(user.email, supabase);

    const gate = await assertDocumentReadableForComments(supabase, documentId, user.email, access);
    if (!gate.ok) {
      return apiError(gate.status, gate.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', gate.message);
    }

    let rowQ = supabase
      .from('document_comments')
      .select(
        'id, document_id, school_number, author_app_user_id, author_email, author_label, body, created_at, updated_at, deleted_at',
      )
      .eq('id', commentId)
      .eq('document_id', documentId)
      .is('deleted_at', null);
    if (gate.doc.school_number) {
      rowQ = rowQ.eq('school_number', gate.doc.school_number);
    }
    const { data: row, error: rowErr } = await rowQ.maybeSingle();

    if (rowErr || !row) {
      return apiError(404, 'NOT_FOUND', 'Kommentar nicht gefunden.');
    }

    const typed = row as DocumentCommentRow;
    if (!isCommentAuthor(typed, access, user.email)) {
      return apiError(403, 'FORBIDDEN', 'Nur der Autor kann diesen Kommentar bearbeiten oder entfernen.');
    }

    const payload = (await req.json().catch(() => ({}))) as { body?: string; delete?: boolean };

    if (payload.delete === true) {
      const now = new Date().toISOString();
      let delQ = supabase
        .from('document_comments')
        .update({ deleted_at: now, updated_at: now })
        .eq('id', commentId)
        .eq('document_id', documentId);
      if (gate.doc.school_number) delQ = delQ.eq('school_number', gate.doc.school_number);
      const { error: delErr } = await delQ;

      if (delErr) {
        return apiError(500, 'INTERNAL_ERROR', delErr.message);
      }
      return NextResponse.json({ ok: true, deleted: true });
    }

    const normalized = normalizeCommentBody(String(payload.body ?? ''));
    if (!normalized.ok) {
      return apiError(400, 'VALIDATION_ERROR', normalized.message);
    }

    const now = new Date().toISOString();
    let updQ = supabase
      .from('document_comments')
      .update({ body: normalized.body, updated_at: now })
      .eq('id', commentId)
      .eq('document_id', documentId);
    if (gate.doc.school_number) updQ = updQ.eq('school_number', gate.doc.school_number);
    const { data: updated, error: updErr } = await updQ
      .select(
        'id, document_id, school_number, author_app_user_id, author_email, author_label, body, created_at, updated_at, deleted_at',
      )
      .single();

    if (updErr || !updated) {
      return apiError(500, 'INTERNAL_ERROR', updErr?.message ?? 'Aktualisierung fehlgeschlagen.');
    }

    return NextResponse.json({
      comment: serializeCommentForApi(updated as DocumentCommentRow),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
