import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';
import { getDocumentText } from '../../../../lib/documentText';
import { buildSearchIndex } from '../../../../lib/indexing';
import { allowedNextStatuses, isValidWorkflowStatus } from '../../../../lib/documentWorkflow';

/**
 * GET: Dokumenten-Metadaten (Leserechte: Mandant + Schutzstufe/Rollen wie canReadDocument).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { school_number: _sn, ...document } = doc as Record<string, unknown>;

    type CurrentVersionRow = {
      id: string;
      version_number: string;
      created_at: string;
      file_uri: string;
      mime_type: string;
    };
    let currentVersion: CurrentVersionRow | null = null;

    const currentVersionId = (doc as { current_version_id?: string | null }).current_version_id;
    if (currentVersionId) {
      let vq = supabase
        .from('document_versions')
        .select('id, version_number, created_at, file_uri, mime_type')
        .eq('id', currentVersionId);
      if (docSchool) vq = vq.eq('school_number', docSchool);
      const { data: ver } = await vq.single();
      if (ver) {
        currentVersion = ver as CurrentVersionRow;
      }
    }

    return NextResponse.json({ document, currentVersion });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}

/**
 * PATCH: Metadaten eines Dokuments aktualisieren (Titel, Status, Rechtsbezug, etc.)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
      .select('id, responsible_unit, status, protection_class_id, school_number, archived_at')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return apiError(404, 'NOT_FOUND', 'Dokument nicht gefunden.');
    }

    const docSchool = (doc as { school_number?: string | null }).school_number ?? null;
    const mayAccessSchool = canAccessSchool(access, docSchool);
    const mayEditByOrg =
      !access.hasAppUser ||
      access.isSchulleitung ||
      access.isSekretariat ||
      (!!access.orgUnit && access.orgUnit === (doc.responsible_unit ?? null));
    const mayAccess = mayAccessSchool && mayEditByOrg && canReadDocument(
      access,
      (doc as { protection_class_id?: number | null }).protection_class_id,
      doc.responsible_unit ?? null
    );
    if (!mayAccess) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für dieses Dokument.');
    }

    const body = (await req.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim();
    }
    if (typeof body.status === 'string') {
      const nextStatus = body.status.trim();
      if (!isValidWorkflowStatus(nextStatus)) {
        return apiError(400, 'VALIDATION_ERROR', 'Ungültiger Status.');
      }
      const currentStatus = (doc as { status?: string }).status ?? 'ENTWURF';
      const allowed = allowedNextStatuses(currentStatus);
      if (!allowed.includes(nextStatus)) {
        return apiError(
          400,
          'VALIDATION_ERROR',
          currentStatus === 'VEROEFFENTLICHT'
            ? 'Veröffentlichte Dokumente können nicht mehr geändert werden.'
            : `Status-Wechsel von "${currentStatus}" zu "${nextStatus}" ist nicht erlaubt. Nächster Schritt: ${allowed.join(' oder ') || 'keiner'}.`
        );
      }
      updates.status = nextStatus;
    }
    if (typeof body.legal_reference === 'string') {
      updates.legal_reference = body.legal_reference.trim() || null;
    }
    if (typeof body.gremium === 'string') {
      updates.gremium = body.gremium.trim() || null;
    }
    if (typeof body.reach_scope === 'string') {
      const v = body.reach_scope.trim().toLowerCase();
      if (v === 'intern' || v === 'extern') updates.reach_scope = v;
    }
    if (Array.isArray(body.participation_groups)) {
      const groups = body.participation_groups
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 20);
      updates.participation_groups = groups;
    }
    if (typeof body.responsible_unit === 'string' && body.responsible_unit.trim()) {
      updates.responsible_unit = body.responsible_unit.trim();
    }
    if (typeof body.document_type_code === 'string' && body.document_type_code.trim()) {
      updates.document_type_code = body.document_type_code.trim();
    }
    if (body.review_date === null) {
      updates.review_date = null;
    } else if (typeof body.review_date === 'string') {
      const v = body.review_date.trim();
      // Erwartet: YYYY-MM-DD oder leer
      if (v.length === 0) {
        updates.review_date = null;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        updates.review_date = v;
      }
    }
    if (typeof body.protection_class_id === 'number' && [1, 2, 3].includes(body.protection_class_id)) {
      updates.protection_class_id = body.protection_class_id;
    }
    if (typeof body.protection_class_id === 'string') {
      const pc = parseInt(body.protection_class_id, 10);
      if ([1, 2, 3].includes(pc)) updates.protection_class_id = pc;
    }
    if (typeof body.archived === 'boolean') {
      updates.archived_at = body.archived ? new Date().toISOString() : null;
    }

    if (Object.keys(updates).length === 0) {
      return apiError(400, 'VALIDATION_ERROR', 'Keine gültigen Felder zum Aktualisieren.');
    }

    let oldDocQuery = supabase.from('documents').select('*').eq('id', documentId);
    if (docSchool) oldDocQuery = oldDocQuery.eq('school_number', docSchool);
    const { data: oldDoc } = await oldDocQuery.single();

    let updateQuery = supabase.from('documents').update(updates).eq('id', documentId);
    if (docSchool) updateQuery = updateQuery.eq('school_number', docSchool);
    const { data: updatedRow, error: updateError } = await updateQuery
      .select('archived_at')
      .single();

    if (updateError) {
      return apiError(500, 'INTERNAL_ERROR', updateError.message);
    }

    const oldValues = oldDoc as Record<string, unknown> | null;
    const changedKeys = Object.keys(updates);
    const oldSlice = oldValues && changedKeys.length > 0
      ? Object.fromEntries(changedKeys.filter((k) => k in (oldValues ?? {})).map((k) => [k, oldValues![k]]))
      : null;
    const { error: auditErr } = await supabase.from('audit_log').insert({
      user_email: user.email,
      action: 'document.update',
      entity_type: 'document',
      entity_id: documentId,
      school_number: docSchool,
      old_values: oldSlice,
      new_values: updates,
    });
    if (auditErr) {
      // audit_log Tabelle optional (Migration ggf. noch nicht ausgeführt)
    }

    // GAP-Fix: Wenn index-relevante Metadaten geändert wurden, search_text/keywords sofort nachziehen,
    // damit die Freitextsuche nicht bis zum nächsten Reindex/Version-Upload "hinterherhinkt".
    const INDEX_RELEVANT_KEYS = new Set([
      'title',
      'document_type_code',
      'gremium',
      'responsible_unit',
      'participation_groups',
      'legal_reference',
      'summary',
    ]);
    const shouldReindex = Object.keys(updates).some((k) => INDEX_RELEVANT_KEYS.has(k));
    if (shouldReindex) {
      let docForIndexQuery = supabase
        .from('documents')
        .select('id, title, document_type_code, gremium, responsible_unit, reach_scope, participation_groups, summary, legal_reference, school_number')
        .eq('id', documentId);
      if (docSchool) docForIndexQuery = docForIndexQuery.eq('school_number', docSchool);
      const { data: docForIndex } = await docForIndexQuery.single();

      if (docForIndex?.title) {
        let extractedText: string | null = null;
        try {
          extractedText = await getDocumentText(documentId);
        } catch {
          extractedText = null;
        }

        const idx = buildSearchIndex({
          title: String(docForIndex.title),
          documentType: (docForIndex.document_type_code as string | null) ?? null,
          gremium: (docForIndex.gremium as string | null) ?? null,
          responsibleUnit: (docForIndex.responsible_unit as string | null) ?? null,
          reachScope: (docForIndex.reach_scope as string | null) ?? null,
          participationGroups: (docForIndex.participation_groups as string[] | null) ?? null,
          summary: (docForIndex.summary as string | null) ?? null,
          legalReference: (docForIndex.legal_reference as string | null) ?? null,
          extractedText,
        });

        let idxUpdate = supabase
          .from('documents')
          .update({ search_text: idx.searchText, keywords: idx.keywords, indexed_at: new Date().toISOString() })
          .eq('id', documentId);
        if (docSchool) idxUpdate = idxUpdate.eq('school_number', docSchool);
        await idxUpdate;
      }
    }

    const archivedAt =
      updatedRow && typeof updatedRow === 'object' && 'archived_at' in updatedRow
        ? (updatedRow as { archived_at: string | null }).archived_at
        : null;

    return NextResponse.json({
      success: true,
      document: { archived_at: archivedAt },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}

/**
 * DELETE: Dokument löschen (inkl. Versionen und Storage-Dateien).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
      .select('id, responsible_unit, protection_class_id, school_number, archived_at')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return apiError(404, 'NOT_FOUND', 'Dokument nicht gefunden.');
    }

    const archivedAt = (doc as { archived_at?: string | null }).archived_at ?? null;
    if (!archivedAt) {
      return apiError(
        400,
        'VALIDATION_ERROR',
        'Nur archivierte Dokumente können endgültig gelöscht werden. Legen Sie das Dokument zuerst ins Archiv.',
      );
    }

    const docSchool = (doc as { school_number?: string | null }).school_number ?? null;
    const mayAccessSchool = canAccessSchool(access, docSchool);
    const mayEditByOrg =
      !access.hasAppUser ||
      access.isSchulleitung ||
      access.isSekretariat ||
      (!!access.orgUnit && access.orgUnit === (doc.responsible_unit ?? null));
    const mayAccess = mayAccessSchool && mayEditByOrg && canReadDocument(
      access,
      (doc as { protection_class_id?: number | null }).protection_class_id,
      doc.responsible_unit ?? null
    );
    if (!mayAccess) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung, dieses Dokument zu löschen.');
    }

    let versionsQuery = supabase
      .from('document_versions')
      .select('id, file_uri')
      .eq('document_id', documentId);
    if (docSchool) versionsQuery = versionsQuery.eq('school_number', docSchool);
    const { data: versions } = await versionsQuery;

    const filePaths = (versions ?? [])
      .map((v) => v.file_uri as string)
      .filter((p) => p && typeof p === 'string');

    if (filePaths.length > 0) {
      await supabase.storage.from('documents').remove(filePaths);
    }

    // Audit-Logs zuerst entfernen (FK-Constraint in manchen Schemas: audit_logs.document_id -> documents.id)
    // Best-effort, damit Löschung nicht daran scheitert, wenn Tabelle/Spalten abweichen.
    try {
      let delAuditLegacy = supabase.from('audit_logs').delete().eq('document_id', documentId);
      if (docSchool) delAuditLegacy = delAuditLegacy.eq('school_number', docSchool);
      await delAuditLegacy;
    } catch {
      // ignore
    }
    try {
      let delAudit = supabase
        .from('audit_log')
        .delete()
        .eq('entity_type', 'document')
        .eq('entity_id', documentId);
      if (docSchool) delAudit = delAudit.eq('school_number', docSchool);
      await delAudit;
    } catch {
      // ignore
    }

    let delVersions = supabase.from('document_versions').delete().eq('document_id', documentId);
    if (docSchool) delVersions = delVersions.eq('school_number', docSchool);
    await delVersions;

    let delDoc = supabase.from('documents').delete().eq('id', documentId);
    if (docSchool) delDoc = delDoc.eq('school_number', docSchool);
    const { error: deleteDocError } = await delDoc;

    if (deleteDocError) {
      return apiError(500, 'INTERNAL_ERROR', deleteDocError.message ?? 'Dokument konnte nicht gelöscht werden.');
    }

    const { error: rpcError } = await supabase.rpc('delete_ai_queries_referencing_document', {
      p_document_id: documentId,
      p_school_number: docSchool,
    });
    if (rpcError) {
      return apiError(
        500,
        'INTERNAL_ERROR',
        rpcError.message ??
          'Dokument wurde entfernt; KI-Anfragen konnten nicht bereinigt werden. Bitte Migration prüfen (delete_ai_queries_referencing_document).',
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
