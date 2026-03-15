/**
 * Supabase-Client für API-Routes/Server, liest Session aus Cookies.
 * Nutzer für Auth-Prüfung – nicht für Service-Role-Operationen.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export async function createServerSupabaseClient() {
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Kann ignoriert werden, wenn Middleware die Session aktualisiert
        }
      },
    },
  });
}
