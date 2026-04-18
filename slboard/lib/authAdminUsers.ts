import type { SupabaseClient } from '@supabase/supabase-js';
import { MIN_APP_PASSWORD_LENGTH } from './authPasswordConstants';

const PER_PAGE = 200;

/** Sucht einen Auth-User per E-Mail (paginiert). */
export async function findAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  for (let p = 1; p <= 50; p++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: p, perPage: PER_PAGE });
    if (error) return null;
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === normalized);
    if (found?.id) return found.id;
    if (data.users.length < PER_PAGE) break;
  }
  return null;
}

/**
 * Legt ein Passwort für die Anmeldung fest: bestehenden Auth-User aktualisieren oder neu anlegen.
 * Bei geänderter E-Mail in app_users: lookupEmail = alte E-Mail, email = neue.
 */
export async function ensureAuthCredentials(
  supabase: SupabaseClient,
  params: {
    email: string;
    password: string;
    schoolNumber: string;
    /** Frühere E-Mail, falls in app_users gewechselt wurde (Suche nach Auth-User) */
    lookupEmail?: string | null;
    /** Wenn true: Init-/Temp-Passwort; Nutzer muss beim ersten Login wechseln. */
    requirePasswordChange?: boolean;
  }
): Promise<void> {
  const { password, schoolNumber, requirePasswordChange = false } = params;
  if (!password || password.length < MIN_APP_PASSWORD_LENGTH) {
    throw new Error(`Passwort muss mindestens ${MIN_APP_PASSWORD_LENGTH} Zeichen haben.`);
  }
  const normalized = params.email.trim().toLowerCase();
  const lookup = (params.lookupEmail ?? params.email).trim().toLowerCase();

  const mergeMeta = (prev: Record<string, unknown>) => ({
    ...prev,
    school_number: schoolNumber,
    ...(requirePasswordChange
      ? { password_change_required: true }
      : ({} as Record<string, unknown>)),
  });

  const syncAppUserFlag = async (flag: boolean) => {
    if (!flag) return;
    const { error } = await supabase
      .from('app_users')
      .update({ password_change_required: true })
      .eq('email', normalized)
      .eq('school_number', schoolNumber);
    if (error) throw new Error(error.message);
  };

  let authId = await findAuthUserIdByEmail(supabase, lookup);
  if (!authId && lookup !== normalized) {
    authId = await findAuthUserIdByEmail(supabase, normalized);
  }

  if (authId) {
    const { data: existing, error: getErr } = await supabase.auth.admin.getUserById(authId);
    if (getErr) throw new Error(getErr.message);
    const prevMeta = (existing?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const { error } = await supabase.auth.admin.updateUserById(authId, {
      email: normalized,
      password,
      email_confirm: true,
      user_metadata: mergeMeta(prevMeta),
    });
    if (error) throw new Error(error.message);
    if (requirePasswordChange) {
      await syncAppUserFlag(true);
    }
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
    user_metadata: {
      school_number: schoolNumber,
      ...(requirePasswordChange ? { password_change_required: true } : {}),
    },
  });
  if (error) throw new Error(error.message);
  if (requirePasswordChange) {
    await syncAppUserFlag(true);
  }
}
