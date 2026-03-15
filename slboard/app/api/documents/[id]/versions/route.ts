import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';

const ROLES_SEE_ALL = ['SCHULLEITUNG', 'SEKRETARIAT'];

async function userMayAccessDocument(
  authEmail: string,
  docResponsibleUnit: string,
  supabase: ReturnType<typeof supabaseServer>
): Promise<boolean> {
  try {
    if (!supabase) return false;
    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, org_unit')
      .eq('email', authEmail)
      .single();
    if (!appUser) return true;
    const { data: roles } = await supabase
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
 * GET: Alle Versionen eines Dokuments (für Versionen-Historie).
 */
export async function GET(
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
      .select('id, responsible_unit, current_version_id')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokument nicht gefunden.' }, { status: 404 });
    }

    const mayAccess = await userMayAccessDocument(user.email, doc.responsible_unit ?? '', supabase);
    if (!mayAccess) {
      return NextResponse.json({ error: 'Keine Berechtigung für dieses Dokument.' }, { status: 403 });
    }

    const { data: versions, error: verError } = await supabase
      .from('document_versions')
      .select('id, version_number, created_at, comment, mime_type')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (verError) {
      return NextResponse.json({ error: verError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: (versions ?? []).map((v) => ({
        id: v.id,
        version_number: v.version_number,
        created_at: v.created_at,
        comment: v.comment ?? null,
        mime_type: v.mime_type ?? null,
        is_current: v.id === doc.current_version_id,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
