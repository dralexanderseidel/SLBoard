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
 * GET: Audit-Log für ein Dokument (wer hat was wann geändert).
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
      .select('id, responsible_unit')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokument nicht gefunden.' }, { status: 404 });
    }

    const mayAccess = await userMayAccessDocument(user.email, doc.responsible_unit ?? '', supabase);
    if (!mayAccess) {
      return NextResponse.json({ error: 'Keine Berechtigung für dieses Dokument.' }, { status: 403 });
    }

    const { data: logs, error: logError } = await supabase
      .from('audit_log')
      .select('id, user_email, action, old_values, new_values, created_at')
      .eq('entity_type', 'document')
      .eq('entity_id', documentId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (logError) {
      // Tabelle audit_log optional (Migration ggf. noch nicht ausgeführt)
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: logs ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
