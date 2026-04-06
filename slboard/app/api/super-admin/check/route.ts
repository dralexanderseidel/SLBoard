import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { isSuperAdmin } from '../../../../lib/superAdminAuth';

export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const {
      data: { user },
    } = (await client?.auth.getUser()) ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ superAdmin: false });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ superAdmin: false });
    }

    const ok = await isSuperAdmin(user.email, supabase);
    return NextResponse.json({ superAdmin: ok });
  } catch {
    return NextResponse.json({ superAdmin: false });
  }
}
