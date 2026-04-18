import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { SCHOOL_INACTIVE_API_MESSAGE } from './lib/schoolInactiveMessages'
import { PASSWORD_CHANGE_REQUIRED_API_MESSAGE } from './lib/passwordChangeRequiredMessages'
import { normalizeAuthEmail } from './lib/authEmail'

/** Muss mit ACTIVE_SCHOOL_COOKIE in lib/schoolSession.ts übereinstimmen. */
const SCHOOL_COOKIE = 'slb_active_school'

/** Service-Role-Client für den Schul-Aktiv-Check (umgeht RLS, Edge-kompatibel). */
function makeAdminClient(url: string, key: string) {
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

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
  const isPublicPath =
    pathname === '/login' ||
    pathname === '/register-school' ||
    pathname === '/hilfe' ||
    pathname.startsWith('/hilfe/')

  // API-Requests und öffentliche Routen nicht umleiten.
  if (!isApi && !isPublicPath && !user) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (!isApi && user && (pathname === '/login' || pathname === '/register-school')) {
    const appUrl = new URL('/', request.url)
    return NextResponse.redirect(appUrl)
  }

  // Schul-Deaktivierung prüfen – nur wenn Nutzer angemeldet und Service-Role-Key vorhanden.
  // Schulnummer: zuerst Cookie, dann user_metadata (Fallback für alte Sessions ohne Cookie).
  if (user && serviceKey) {
    const cookieSchool = request.cookies.get(SCHOOL_COOKIE)?.value?.trim() ?? ''
    const metaSchool = ((user.user_metadata as Record<string, unknown> | null)?.school_number as string | undefined)?.trim() ?? ''
    const schoolNumber = /^\d{6}$/.test(cookieSchool) ? cookieSchool : metaSchool
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
              { error: SCHOOL_INACTIVE_API_MESSAGE, code: 'SCHOOL_INACTIVE' },
              { status: 403 }
            )
          }
          const loginUrl = new URL('/login', request.url)
          loginUrl.searchParams.set('reason', 'school_inactive')
          const redirect = NextResponse.redirect(loginUrl)
          redirect.cookies.set(SCHOOL_COOKIE, '', { maxAge: 0, path: '/' })
          return redirect
        }

        const { data: appRow } = await admin
          .from('app_users')
          .select('password_change_required')
          .eq('email', normalizeAuthEmail(user.email!))
          .eq('school_number', schoolNumber)
          .maybeSingle()

        if (
          appRow &&
          (appRow as { password_change_required?: boolean }).password_change_required
        ) {
          const exempt =
            pathname === '/change-password' ||
            pathname === '/hilfe' ||
            pathname.startsWith('/hilfe/') ||
            pathname === '/api/auth/change-password' ||
            pathname === '/api/auth/set-school-context'
          if (!exempt) {
            if (isApi) {
              return NextResponse.json(
                { error: PASSWORD_CHANGE_REQUIRED_API_MESSAGE, code: 'PASSWORD_CHANGE_REQUIRED' },
                { status: 403 }
              )
            }
            return NextResponse.redirect(new URL('/change-password', request.url))
          }
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
