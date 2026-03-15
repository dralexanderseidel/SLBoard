/**
 * Server-seitiger Supabase-Client mit Service-Role-Key.
 * Nur in API-Routen / Server Components verwenden – nie im Client exponieren!
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

/** Gibt den Admin-Client zurück oder null, falls der Service-Role-Key fehlt. */
export function supabaseServer(): SupabaseClient | null {
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

/** @deprecated Verwende supabaseServer(). */
export const supabaseAdmin = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false } })
  : null
