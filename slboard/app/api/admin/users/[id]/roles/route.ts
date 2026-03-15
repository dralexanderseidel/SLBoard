import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../../../lib/adminAuth';

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

    const { id: userId } = await params;
    const body = await req.json();
    const roles = Array.isArray(body.roles) ? body.roles.filter((r: unknown) => typeof r === 'string') : [];

    await supabase.from('user_roles').delete().eq('user_id', userId);

    if (roles.length > 0) {
      const { error } = await supabase.from('user_roles').insert(
        roles.map((role_code: string) => ({ user_id: userId, role_code }))
      );
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ roles });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
