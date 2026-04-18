import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

/** Muss mit ACTIVE_SCHOOL_COOKIE in lib/schoolSession.ts übereinstimmen. */
const SCHOOL_COOKIE = 'slb_active_school'

/** Service-Role-Client für den Schul-Aktiv-Check (umgeht RLS, Edge-kompatibel). */
function makeAdminClient(url: string, key: string) {
  return createClient(url, key, { auth: { persistSession: false } })
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

  // Schul-Deaktivierung prüfen – nur wenn Nutzer angemeldet, Schulcookie gesetzt
  // und Service-Role-Key vorhanden (umgeht RLS zuverlässig).
  if (user && serviceKey) {
    const schoolNumber = request.cookies.get(SCHOOL_COOKIE)?.value?.trim() ?? ''
    if (/^\d{6}$/.test(schoolNumber)) {
      try {
        const admin = makeAdminClient(supabaseUrl, serviceKey)
        const { data: school } = await admin
          .from('schools')
          .select('active')
          .eq('school_number', schoolNumber)
          .maybeSingle()

        if (school !== null && (school as { active?: boolean }).active === false) {
          if (isApi) {
            return NextResponse.json(
              { error: 'Diese Schule ist deaktiviert. Bitte wenden Sie sich an den Plattform-Administrator.' },
              { status: 403 }
            )
          }
          const loginUrl = new URL('/login', request.url)
          loginUrl.searchParams.set('reason', 'school_inactive')
          const redirect = NextResponse.redirect(loginUrl)
          redirect.cookies.set(SCHOOL_COOKIE, '', { maxAge: 0, path: '/' })
          return redirect
        }
      } catch {
        // Schul-Check fehlgeschlagen – fail-open, Zugriff nicht sperren
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
