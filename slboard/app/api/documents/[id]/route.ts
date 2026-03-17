import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';

const ROLES_SEE_ALL = ['SCHULLEITUNG', 'SEKRETARIAT'];

/** Erlaubte Workflow-Übergänge: Entwurf → Freigegeben → Veröffentlicht */
const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  ENTWURF: ['FREIGEGEBEN'],
  FREIGEGEBEN: ['VEROEFFENTLICHT'],
  VEROEFFENTLICHT: [],
};

async function userMayAccessDocument(
  authEmail: string,
  docResponsibleUnit: string,
  supabaseAdmin: ReturnType<typeof supabaseServer>
): Promise<boolean> {
  try {
    if (!supabaseAdmin) return false;
    const { data: appUser } = await supabaseAdmin
      .from('app_users')
      .select('id, org_unit')
      .eq('email', authEmail)
      .single();
    if (!appUser) return true;
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role_code')
      .eq('user_id', appUser.id);
    const hasSeeAll = (roles ?? []).some((r) => ROLES_SEE_ALL.includes(r.role_code));
    if (hasSeeAll) return true;
    return appUser.org_unit === docResponsibleUnit;
  } catch {
    return false;
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
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    }

    const { id: documentId } = await params;

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, responsible_unit, status')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokument nicht gefunden.' }, { status: 404 });
    }

    const mayAccess = await userMayAccessDocument(user.email, doc.responsible_unit ?? '', supabase);
    if (!mayAccess) {
      return NextResponse.json(
        { error: 'Keine Berechtigung für dieses Dokument.' },
        { status: 403 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim();
    }
    if (typeof body.status === 'string' && ['ENTWURF', 'FREIGEGEBEN', 'VEROEFFENTLICHT'].includes(body.status)) {
      const currentStatus = (doc as { status?: string }).status ?? 'ENTWURF';
      const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error:
              currentStatus === 'VEROEFFENTLICHT'
                ? 'Veröffentlichte Dokumente können nicht mehr geändert werden.'
                : `Status-Wechsel von "${currentStatus}" zu "${body.status}" ist nicht erlaubt. Nächster Schritt: ${allowed.join(' oder ') || 'keiner'}.`,
          },
          { status: 400 }
        );
      }
      updates.status = body.status;
    }
    if (typeof body.legal_reference === 'string') {
      updates.legal_reference = body.legal_reference.trim() || null;
    }
    if (typeof body.gremium === 'string') {
      updates.gremium = body.gremium.trim() || null;
    }
    if (typeof body.responsible_unit === 'string' && body.responsible_unit.trim()) {
      updates.responsible_unit = body.responsible_unit.trim();
    }
    if (typeof body.document_type_code === 'string' && body.document_type_code.trim()) {
      updates.document_type_code = body.document_type_code.trim();
    }
    if (typeof body.protection_class_id === 'number' && [1, 2].includes(body.protection_class_id)) {
      updates.protection_class_id = body.protection_class_id;
    }
    if (typeof body.protection_class_id === 'string') {
      const pc = parseInt(body.protection_class_id, 10);
      if ([1, 2].includes(pc)) updates.protection_class_id = pc;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Keine gültigen Felder zum Aktualisieren.' }, { status: 400 });
    }

    const { data: oldDoc } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    const { error: updateError } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', documentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
      old_values: oldSlice,
      new_values: updates,
    });
    if (auditErr) {
      // audit_log Tabelle optional (Migration ggf. noch nicht ausgeführt)
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
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
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    }

    const { id: documentId } = await params;

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, responsible_unit')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokument nicht gefunden.' }, { status: 404 });
    }

    const mayAccess = await userMayAccessDocument(user.email, doc.responsible_unit ?? '', supabase);
    if (!mayAccess) {
      return NextResponse.json(
        { error: 'Keine Berechtigung, dieses Dokument zu löschen.' },
        { status: 403 }
      );
    }

    const { data: versions } = await supabase
      .from('document_versions')
      .select('id, file_uri')
      .eq('document_id', documentId);

    const filePaths = (versions ?? [])
      .map((v) => v.file_uri as string)
      .filter((p) => p && typeof p === 'string');

    if (filePaths.length > 0) {
      await supabase.storage.from('documents').remove(filePaths);
    }

    // Audit-Logs zuerst entfernen (FK-Constraint in manchen Schemas: audit_logs.document_id -> documents.id)
    // Best-effort, damit Löschung nicht daran scheitert, wenn Tabelle/Spalten abweichen.
    try {
      await supabase.from('audit_logs').delete().eq('document_id', documentId);
    } catch {
      // ignore
    }
    try {
      await supabase.from('audit_log').delete().eq('entity_type', 'document').eq('entity_id', documentId);
    } catch {
      // ignore
    }

    await supabase.from('document_versions').delete().eq('document_id', documentId);
    const { error: deleteDocError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (deleteDocError) {
      return NextResponse.json(
        { error: deleteDocError.message ?? 'Dokument konnte nicht gelöscht werden.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
