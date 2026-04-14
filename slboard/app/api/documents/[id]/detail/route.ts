import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../../../lib/documentAccess';
import { apiError } from '../../../../../lib/apiError';

/**
 * GET: Dokument + Versionshistorie + Audit-Log in einer einzigen Anfrage.
 *
 * Ersetzt die drei separaten Aufrufe /[id], /[id]/versions und /[id]/audit
 * auf der Detailseite. Auth, resolveUserAccess und der documents-Row-Read
 * laufen hier genau einmal; die drei Folge-Queries (currentVersion, versions,
 * audit_log) laufen parallel via Promise.all.
 */
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

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select(
        'id, title, document_type_code, created_at, archived_at, status, protection_class_id, reach_scope, gremium, responsible_unit, participation_groups, legal_reference, summary, summary_updated_at, review_date, current_version_id, steering_analysis, steering_analysis_updated_at, school_number',
      )
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return apiError(404, 'NOT_FOUND', 'Dokument nicht gefunden.');
    }

    const docSchool = (doc as { school_number?: string | null }).school_number ?? null;
    const mayAccessSchool = canAccessSchool(access, docSchool);
    const mayRead = canReadDocument(
      access,
      (doc as { protection_class_id?: number | null }).protection_class_id,
      (doc as { responsible_unit?: string | null }).responsible_unit ?? null,
    );
    if (!mayAccessSchool || !mayRead) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für dieses Dokument.');
    }

    const currentVersionId = (doc as { current_version_id?: string | null }).current_version_id;

    // ── Alle drei Folge-Queries parallel ─────────────────────────────────────
    let currentVersionQuery = currentVersionId
      ? supabase
          .from('document_versions')
          .select('id, version_number, created_at, file_uri, mime_type')
          .eq('id', currentVersionId)
          .single()
      : Promise.resolve({ data: null, error: null });

    if (currentVersionId && docSchool) {
      currentVersionQuery = supabase
        .from('document_versions')
        .select('id, version_number, created_at, file_uri, mime_type')
        .eq('id', currentVersionId)
        .eq('school_number', docSchool)
        .single();
    }

    let versionsQuery = supabase
      .from('document_versions')
      .select('id, version_number, created_at, comment, mime_type')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });
    if (docSchool) versionsQuery = versionsQuery.eq('school_number', docSchool);

    let auditQuery = supabase
      .from('audit_log')
      .select('id, user_email, action, old_values, new_values, created_at')
      .eq('entity_type', 'document')
      .eq('entity_id', documentId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (docSchool) auditQuery = auditQuery.eq('school_number', docSchool);

    const [currentVersionResult, versionsResult, auditResult] = await Promise.all([
      currentVersionQuery,
      versionsQuery,
      auditQuery,
    ]);

    // ── Antwort zusammenstellen ───────────────────────────────────────────────
    const { school_number: _sn, ...document } = doc as Record<string, unknown>;

    const currentVersion = currentVersionResult.data ?? null;

    const versions = (versionsResult.data ?? []).map((v) => ({
      id: v.id,
      version_number: v.version_number,
      created_at: v.created_at,
      comment: (v as { comment?: string | null }).comment ?? null,
      mime_type: (v as { mime_type?: string | null }).mime_type ?? null,
      is_current: v.id === currentVersionId,
    }));

    const auditLog = auditResult.error ? [] : (auditResult.data ?? []);

    return NextResponse.json({ document, currentVersion, versions, auditLog });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
