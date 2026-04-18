import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Muss mit ACTIVE_SCHOOL_COOKIE in lib/schoolSession.ts übereinstimmen. */
const SCHOOL_COOKIE = 'slb_active_school'

/** Prüft via Supabase REST API (service role), ob die Schule aktiv ist.
 *  Gibt true zurück, wenn aktiv oder Status unbekannt (fail-open). */
async function isSchoolActive(supabaseUrl: string, serviceKey: string, schoolNumber: string): Promise<boolean> {
  if (!serviceKey || !schoolNumber) return true
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/schools?school_number=eq.${encodeURIComponent(schoolNumber)}&select=active&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json',
        },
      }
    )
    if (!res.ok) return true
    const rows = (await res.json()) as { active?: boolean }[]
    if (!rows.length) return true
    return rows[0].active !== false
  } catch {
    return true // Im Fehlerfall nicht sperren
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Session aktualisieren, damit Cookies für API-Routes verfügbar sind
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/')
  const isPublicPath = pathname === '/login' || pathname === '/register-school'

  // API-Requests und öffentliche Routen nicht umleiten.
  if (!isApi && !isPublicPath && !user) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (!isApi && user && (pathname === '/login' || pathname === '/register-school')) {
    const appUrl = new URL('/', request.url)
    return NextResponse.redirect(appUrl)
  }

  // Schul-Deaktivierung prüfen – nur wenn Nutzer angemeldet und Schulcookie gesetzt
  if (user) {
    const schoolNumber = request.cookies.get(SCHOOL_COOKIE)?.value?.trim() ?? ''
    if (/^\d{6}$/.test(schoolNumber)) {
      const active = await isSchoolActive(supabaseUrl, serviceKey, schoolNumber)
      if (!active) {
        if (isApi) {
          return NextResponse.json(
            { error: 'Diese Schule ist deaktiviert. Bitte wenden Sie sich an den Plattform-Administrator.' },
            { status: 403 }
          )
        }
        // Seiten-Requests zur Login-Seite umleiten
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('reason', 'school_inactive')
        const redirect = NextResponse.redirect(loginUrl)
        // Schulcookie entfernen
        redirect.cookies.set(SCHOOL_COOKIE, '', { maxAge: 0, path: '/' })
        return redirect
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
