import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../lib/supabaseServerClient';

const ROLES_SEE_ALL = ['SCHULLEITUNG', 'SEKRETARIAT'];

async function getUserOrgUnitAndRoles(
  authEmail: string,
  supabase: ReturnType<typeof supabaseServer>
): Promise<{ orgUnit: string | null; maySeeAll: boolean }> {
  try {
    if (!supabase) return { orgUnit: null, maySeeAll: true };
    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, org_unit')
      .eq('email', authEmail)
      .single();
    if (!appUser) return { orgUnit: null, maySeeAll: true };
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_code')
      .eq('user_id', appUser.id);
    const hasSeeAll = (roles ?? []).some((r) => ROLES_SEE_ALL.includes(r.role_code));
    return { orgUnit: appUser.org_unit ?? null, maySeeAll: hasSeeAll };
  } catch {
    return { orgUnit: null, maySeeAll: false };
  }
}

/**
 * GET: Dokumentenliste mit Berechtigungsfilter.
 * Schulleitung/Sekretariat sehen alle; sonst nur Dokumente der eigenen Organisationseinheit.
 * Query-Parameter: type, status, protectionClass, search
 */
export async function GET(req: NextRequest) {
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

    const { orgUnit, maySeeAll } = await getUserOrgUnitAndRoles(user.email, supabase);

    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type') ?? '';
    const statusFilter = searchParams.get('status') ?? '';
    const protectionFilter = searchParams.get('protectionClass') ?? '';
    const searchQuery = searchParams.get('search') ?? '';

    let query = supabase
      .from('documents')
      .select('id, title, document_type_code, created_at, status, protection_class_id, gremium, responsible_unit')
      .order('created_at', { ascending: false });

    if (!maySeeAll && orgUnit) {
      query = query.eq('responsible_unit', orgUnit);
    }

    if (searchQuery.trim()) {
      const pattern = `%${searchQuery.trim()}%`;
      // Volltextsuche: Metadaten + inhaltsbasiert (summary, legal_reference)
      query = query.or(
        `title.ilike.${pattern},document_type_code.ilike.${pattern},gremium.ilike.${pattern},summary.ilike.${pattern},legal_reference.ilike.${pattern}`
      );
    }

    if (typeFilter) {
      query = query.eq('document_type_code', typeFilter);
    }

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (protectionFilter) {
      const pc = Number(protectionFilter);
      if (!Number.isNaN(pc)) {
        query = query.eq('protection_class_id', pc);
      }
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
