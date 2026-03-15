import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../../lib/adminAuth';

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

    if (!(await isAdmin(user.email, supabase))) {
      return NextResponse.json({ error: 'Keine Admin-Berechtigung.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, string> = {};
    if (typeof body.username === 'string' && body.username.trim()) updates.username = body.username.trim();
    if (typeof body.full_name === 'string' && body.full_name.trim()) updates.full_name = body.full_name.trim();
    if (typeof body.email === 'string' && body.email.trim()) updates.email = body.email.trim();
    if (typeof body.org_unit === 'string' && body.org_unit.trim()) updates.org_unit = body.org_unit.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Keine Felder zum Aktualisieren.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', id)
      .select('id, username, full_name, email, org_unit, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
