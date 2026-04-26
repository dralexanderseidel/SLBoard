import { supabaseServer } from './supabaseServer';
import { getActiveSchoolNumberFromCookies, normalizeAuthEmail } from './schoolSession';

type SupabaseAdmin = ReturnType<typeof supabaseServer>;

export type UserAccessContext = {
  hasAppUser: boolean;
  /** UUID des app_users-Eintrags; null wenn kein Eintrag gefunden */
  appUserId: string | null;
  orgUnit: string | null;
  schoolNumber: string | null;
  roles: string[];
  isSchulleitung: boolean;
  isSekretariat: boolean;
  /** Mehrere Schul-Konten unter derselben E-Mail, aber kein Schul-Kontext (Cookie/JWT) gesetzt */
  needsSchoolContext?: boolean;
  /** Schule wurde vom Super-Admin deaktiviert; hasAppUser ist in diesem Fall false */
  schoolInactive?: boolean;
  /** Schul-Admin hat dieses Konto deaktiviert; Zugriff wie ohne app_users-Zeile */
  accountInactive?: boolean;
};

const emptyContext = (): UserAccessContext => ({
  hasAppUser: false,
  appUserId: null,
  orgUnit: null,
  schoolNumber: null,
  roles: [],
  isSchulleitung: false,
  isSekretariat: false,
});

/**
 * Lädt app_users inkl. Rollen.
 * @param activeSchoolNumber — aus Cookie/JWT (6 Ziffern); ohne mehrdeutige E-Mail-Zuordnung
 */
export async function getUserAccessContext(
  authEmail: string,
  supabase: SupabaseAdmin,
  activeSchoolNumber?: string | null
): Promise<UserAccessContext> {
  try {
    if (!supabase) {
      return emptyContext();
    }

    const emailNorm = normalizeAuthEmail(authEmail);
    if (!emailNorm) {
      return emptyContext();
    }

    const { data: rows, error } = await supabase
      .from('app_users')
      .select('id, org_unit, school_number, active')
      .eq('email', emailNorm);

    if (error || !rows?.length) {
      return emptyContext();
    }

    const schoolTrim = activeSchoolNumber?.trim() ?? '';
    const schoolOk = schoolTrim.length === 6 && /^\d{6}$/.test(schoolTrim);
    let appUser: { id: string; org_unit: string | null; school_number: string | null } | undefined;

    if (schoolOk) {
      appUser = rows.find((r) => (r.school_number as string | null) === schoolTrim);
      if (!appUser) {
        return emptyContext();
      }
    } else if (rows.length === 1) {
      appUser = rows[0] as typeof appUser;
    } else {
      return {
        ...emptyContext(),
        needsSchoolContext: true,
      };
    }

    // Schul-Status und Rollen parallel laden
    const resolvedSchool = (appUser!.school_number as string | null) ?? schoolTrim;
    const [{ data: rolesRows }, { data: schoolRow }] = await Promise.all([
      supabase.from('user_roles').select('role_code').eq('user_id', appUser!.id),
      resolvedSchool
        ? supabase.from('schools').select('active').eq('school_number', resolvedSchool).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Wenn Schule explizit deaktiviert ist, Zugriff verweigern
    if (schoolRow && (schoolRow as { active?: boolean } | null)?.active === false) {
      return { ...emptyContext(), schoolInactive: true };
    }

    if ((appUser as { active?: boolean }).active === false) {
      return {
        ...emptyContext(),
        accountInactive: true,
      };
    }

    const roles = (rolesRows ?? []).map((r) => r.role_code as string).filter(Boolean);
    const isSchulleitung = roles.includes('SCHULLEITUNG');
    const isSekretariat = roles.includes('SEKRETARIAT');

    return {
      hasAppUser: true,
      appUserId: appUser!.id as string,
      orgUnit: (appUser!.org_unit as string | null) ?? null,
      schoolNumber: (appUser!.school_number as string | null) ?? null,
      roles,
      isSchulleitung,
      isSekretariat,
    };
  } catch {
    return emptyContext();
  }
}

/** Server: Schul-Kontext aus Cookie, dann app_users. */
export async function resolveUserAccess(
  authEmail: string,
  supabase: SupabaseAdmin
): Promise<UserAccessContext> {
  const school = await getActiveSchoolNumberFromCookies();
  return getUserAccessContext(authEmail, supabase, school);
}

/**
 * Übergangslogik Phase 1:
 * - Wenn beim Nutzer noch keine school_number gesetzt ist, bleibt Zugriff wie bisher.
 * - Wenn school_number gesetzt ist, darf nur auf Daten derselben Schule zugegriffen werden.
 */
export function canAccessSchool(access: UserAccessContext, rowSchoolNumber?: string | null): boolean {
  const userSchool = (access.schoolNumber ?? '').trim();
  if (!userSchool) return true;
  const rowSchool = (rowSchoolNumber ?? '').trim();
  if (!rowSchool) return false;
  return userSchool === rowSchool;
}

/**
 * Schutzstufen:
 * 1 = Öffentlich (alle angemeldeten Lehrkräfte)
 * 2 = Verwaltung/Sekretariat + Schulleitung
 * 3 = nur Schulleitung
 */
export function canReadDocument(
  access: UserAccessContext,
  protectionClassId: number | null | undefined,
  responsibleUnit?: string | null
): boolean {
  const pc = Number(protectionClassId ?? 1);
  const hasLevel2AccessRole =
    access.isSchulleitung ||
    access.isSekretariat ||
    access.roles.includes('VERWALTUNG') ||
    access.roles.includes('KOORDINATION');

  if (pc >= 3) {
    return access.isSchulleitung;
  }

  if (pc === 2) {
    return hasLevel2AccessRole;
  }

  if (pc === 1) {
    // Level 1: öffentlich, aber nur für Lehrkräfte (DSGVO-Kontext)
    return access.roles.includes('LEHRKRAFT') || hasLevel2AccessRole;
  }

  // Fallback für unbekannte Werte: restriktiv
  return (
    access.isSchulleitung ||
    access.isSekretariat ||
    (!!access.orgUnit && !!responsibleUnit && access.orgUnit === responsibleUnit)
  );
}
