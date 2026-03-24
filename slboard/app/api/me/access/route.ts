import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { getUserAccessContext } from '../../../../lib/documentAccess';

export async function GET() {
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

    const access = await getUserAccessContext(user.email, supabase);
    let schoolName: string | null = null;

    if (access.schoolNumber) {
      const { data: school } = await supabase
        .from('schools')
        .select('name')
        .eq('school_number', access.schoolNumber)
        .maybeSingle();
      schoolName = (school?.name as string | undefined) ?? null;
    }

    return NextResponse.json({
      schoolNumber: access.schoolNumber,
      schoolName,
      orgUnit: access.orgUnit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

