import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAuthEmail } from './authEmail';
import { DOCUMENT_COMMENT_BODY_MAX_CHARS } from './documentCommentsConstants';
import { canAccessSchool, canReadDocument, type UserAccessContext } from './documentAccess';

export { DOCUMENT_COMMENT_BODY_MAX_CHARS };

export type DocumentCommentRow = {
  id: string;
  document_id: string;
  school_number: string;
  author_app_user_id: string | null;
  author_email: string;
  author_label: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export async function fetchActiveCommentsForDocument(
  supabase: SupabaseClient,
  documentId: string,
  schoolNumber: string | null
): Promise<DocumentCommentRow[]> {
  let q = supabase
    .from('document_comments')
    .select(
      'id, document_id, school_number, author_app_user_id, author_email, author_label, body, created_at, updated_at, deleted_at',
    )
    .eq('document_id', documentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (schoolNumber) q = q.eq('school_number', schoolNumber);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as DocumentCommentRow[];
}

/** Lädt Dokumentzeile und prüft Leserecht (Kommentieren = Lesen). */
export async function assertDocumentReadableForComments(
  supabase: SupabaseClient,
  documentId: string,
  authEmail: string,
  access: UserAccessContext
): Promise<
  | {
      ok: true;
      doc: {
        id: string;
        school_number: string | null;
        protection_class_id: number | null;
        responsible_unit: string | null;
      };
    }
  | { ok: false; status: 404 | 403; message: string }
> {
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, school_number, protection_class_id, responsible_unit')
    .eq('id', documentId)
    .single();

  if (docError || !doc) {
    return { ok: false, status: 404, message: 'Dokument nicht gefunden.' };
  }

  const docSchool = (doc as { school_number?: string | null }).school_number ?? null;
  const maySchool = canAccessSchool(access, docSchool);
  const mayRead = canReadDocument(
    access,
    (doc as { protection_class_id?: number | null }).protection_class_id,
    (doc as { responsible_unit?: string | null }).responsible_unit ?? null,
  );

  if (!maySchool || !mayRead) {
    return { ok: false, status: 403, message: 'Keine Berechtigung für dieses Dokument.' };
  }

  return {
    ok: true,
    doc: {
      id: doc.id as string,
      school_number: docSchool,
      protection_class_id: (doc as { protection_class_id?: number | null }).protection_class_id ?? null,
      responsible_unit: (doc as { responsible_unit?: string | null }).responsible_unit ?? null,
    },
  };
}

export function normalizeCommentBody(raw: string): { ok: true; body: string } | { ok: false; message: string } {
  const body = (raw ?? '').trim();
  if (!body) return { ok: false, message: 'Kommentar darf nicht leer sein.' };
  if (body.length > DOCUMENT_COMMENT_BODY_MAX_CHARS) {
    return {
      ok: false,
      message: `Kommentar ist zu lang (max. ${DOCUMENT_COMMENT_BODY_MAX_CHARS} Zeichen).`,
    };
  }
  return { ok: true, body };
}

export function serializeCommentForApi(row: DocumentCommentRow) {
  return {
    id: row.id,
    authorEmail: row.author_email,
    authorLabel: row.author_label,
    authorAppUserId: row.author_app_user_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Darf Kommentar bearbeiten/löschen (soft): nur Autor (app_user_id, sonst E-Mail-Fallback). */
export function isCommentAuthor(
  row: DocumentCommentRow,
  access: UserAccessContext,
  authEmail: string
): boolean {
  if (!access.hasAppUser || !access.appUserId) return false;
  if (row.author_app_user_id) {
    return row.author_app_user_id === access.appUserId;
  }
  return normalizeAuthEmail(row.author_email) === normalizeAuthEmail(authEmail);
}
