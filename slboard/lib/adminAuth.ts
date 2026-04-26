/**
 * Admin-Berechtigung: Nutzer mit SCHULLEITUNG oder ADMIN-Rolle dürfen die Admin-API nutzen.
 * Pro Schul-Kontext (Cookie slb_active_school); bei mehreren Zeilen pro E-Mail ist der Kontext nötig.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getActiveSchoolNumberFromCookies, normalizeAuthEmail } from './schoolSession';

const ADMIN_ROLES = ['SCHULLEITUNG', 'ADMIN'];

export async function isAdmin(
  authEmail: string | undefined,
  supabaseAdmin: SupabaseClient | null,
  activeSchoolNumber?: string | null
): Promise<boolean> {
  if (!authEmail || !supabaseAdmin) return false;
  let school = activeSchoolNumber;
  if (school === undefined) {
    school = await getActiveSchoolNumberFromCookies();
  }
  try {
    const emailNorm = normalizeAuthEmail(authEmail);
    let q = supabaseAdmin.from('app_users').select('id, active').eq('email', emailNorm);
    if (school && /^\d{6}$/.test(school)) {
      q = q.eq('school_number', school);
    }
    const { data: rows, error } = await q;
    if (error || !rows?.length) return false;
    if (rows.length > 1) return false;

    const appUser = rows[0] as { id: string; active?: boolean };
    if (appUser.active === false) return false;
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role_code')
      .eq('user_id', appUser.id);
    return (roles ?? []).some((r) => ADMIN_ROLES.includes(r.role_code));
  } catch {
    return false;
  }
}
