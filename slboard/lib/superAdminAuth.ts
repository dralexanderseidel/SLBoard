import type { SupabaseClient } from '@supabase/supabase-js';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

function superAdminEmailsFromEnv(): string[] {
  const raw = (process.env.SUPER_ADMIN_EMAILS ?? '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Super-Admin: entweder E-Mail in SUPER_ADMIN_EMAILS (kommagetrennt) oder Rolle SUPER_ADMIN in user_roles.
 */
export async function isSuperAdmin(
  authEmail: string | undefined,
  supabaseAdmin: SupabaseClient | null
): Promise<boolean> {
  if (!authEmail || !supabaseAdmin) return false;
  const normalized = authEmail.trim().toLowerCase();
  if (superAdminEmailsFromEnv().includes(normalized)) return true;

  try {
    const { data: appUser } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();
    if (!appUser) return false;
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role_code')
      .eq('user_id', (appUser as { id: string }).id);
    return (roles ?? []).some((r) => r.role_code === SUPER_ADMIN_ROLE);
  } catch {
    return false;
  }
}
