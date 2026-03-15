/**
 * Admin-Berechtigung: Nutzer mit SCHULLEITUNG oder ADMIN-Rolle dürfen die Admin-API nutzen.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const ADMIN_ROLES = ['SCHULLEITUNG', 'ADMIN'];

export async function isAdmin(
  authEmail: string | undefined,
  supabaseAdmin: SupabaseClient | null
): Promise<boolean> {
  if (!authEmail || !supabaseAdmin) return false;
  try {
    const { data: appUser } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('email', authEmail)
      .single();
    if (!appUser) return false;
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role_code')
      .eq('user_id', appUser.id);
    return (roles ?? []).some((r) => ADMIN_ROLES.includes(r.role_code));
  } catch {
    return false;
  }
}
