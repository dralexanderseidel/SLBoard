import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Supabase-Umgebungsvariablen fehlen (URL oder ANON_KEY). Aktuelle Werte: URL="${supabaseUrl}", KEY gesetzt=${!!supabaseAnonKey}`
  )
}

// zusätzliche Laufzeitprüfung, um die tatsächlich verwendete URL im Fehlerfall zu sehen
try {
  // wirft, wenn die URL ungültig ist
  // eslint-disable-next-line no-new
  new URL(supabaseUrl)
} catch (e) {
  throw new Error(`Supabase-URL ist ungültig: "${supabaseUrl}"`)
}

/**
 * Browser-Client mit Cookie-Speicherung.
 * Session wird in Cookies gespeichert, damit sie an API-Routes übergeben wird.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

