import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { getUserAccessContext } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';

export async function GET() {
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
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}

