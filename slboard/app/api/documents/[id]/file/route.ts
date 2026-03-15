import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';

const ROLES_SEE_ALL = ['SCHULLEITUNG', 'SEKRETARIAT'];

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
    if (!appUser) return true; // Kein app_user → Demo-Modus, Zugriff erlauben
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
 * Erzeugt eine temporäre Signed URL für die Datei eines Dokuments.
 * Prüft: eingeloggter Nutzer, Rechte (Rolle / responsible_unit).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json(
        { error: 'Anmeldung erforderlich.' },
        { status: 401 }
      );
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Service nicht verfügbar.' },
        { status: 500 }
      );
    }

    const { id: documentId } = await params;
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get('versionId');

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, current_version_id, responsible_unit')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokument nicht gefunden.' }, { status: 404 });
    }

    const mayAccess = await userMayAccessDocument(
      user.email,
      doc.responsible_unit ?? '',
      supabase,
    );
    if (!mayAccess) {
      return NextResponse.json(
        { error: 'Keine Berechtigung für dieses Dokument.' },
        { status: 403 }
      );
    }

    // Bestimmte Version (versionId) oder aktuelle Version
    const versionToUse = versionId && versionId.trim() ? versionId.trim() : (doc.current_version_id as string);
    if (!versionToUse) {
      return NextResponse.json({ error: 'Dokument oder Version nicht gefunden.' }, { status: 404 });
    }

    const { data: ver, error: verError } = await supabase
      .from('document_versions')
      .select('file_uri')
      .eq('id', versionToUse)
      .eq('document_id', documentId)
      .single();

    if (verError || !ver?.file_uri) {
      return NextResponse.json({ error: 'Datei-Pfad nicht gefunden.' }, { status: 404 });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUrl(ver.file_uri, 3600); // 1 Stunde gültig

    if (signedError) {
      return NextResponse.json(
        { error: signedError.message ?? 'Signed URL konnte nicht erzeugt werden.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: signed.signedUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
