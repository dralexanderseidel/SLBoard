import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../../../lib/adminAuth';
import { canAccessSchool, resolveUserAccess } from '../../../../../../lib/documentAccess';
import { apiError } from '../../../../../../lib/apiError';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const access = await resolveUserAccess(user.email, supabase);

    const { id: userId } = await params;
    const body = await req.json();
    const roles = Array.isArray(body.roles) ? body.roles.filter((r: unknown) => typeof r === 'string') : [];

    const { data: target } = await supabase
      .from('app_users')
      .select('id, school_number')
      .eq('id', userId)
      .single();
    const targetSchool = (target as { school_number?: string | null } | null)?.school_number ?? null;
    if (!canAccessSchool(access, targetSchool)) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für diesen Nutzer.');
    }

    await supabase.from('user_roles').delete().eq('user_id', userId);

    if (roles.length > 0) {
      const { error } = await supabase.from('user_roles').insert(
        roles.map((role_code: string) => ({ user_id: userId, role_code }))
      );
      if (error) {
        return apiError(500, 'INTERNAL_ERROR', error.message);
      }
    }

    return NextResponse.json({ roles });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
