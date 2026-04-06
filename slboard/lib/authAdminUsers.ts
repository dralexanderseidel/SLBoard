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
  }
): Promise<void> {
  const { password, schoolNumber } = params;
  if (!password || password.length < MIN_APP_PASSWORD_LENGTH) {
    throw new Error(`Passwort muss mindestens ${MIN_APP_PASSWORD_LENGTH} Zeichen haben.`);
  }
  const normalized = params.email.trim().toLowerCase();
  const lookup = (params.lookupEmail ?? params.email).trim().toLowerCase();

  let authId = await findAuthUserIdByEmail(supabase, lookup);
  if (!authId && lookup !== normalized) {
    authId = await findAuthUserIdByEmail(supabase, normalized);
  }

  if (authId) {
    const { error } = await supabase.auth.admin.updateUserById(authId, {
      email: normalized,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
    user_metadata: {
      school_number: schoolNumber,
    },
  });
  if (error) throw new Error(error.message);
}
