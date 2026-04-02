import { supabaseServer } from './supabaseServer';

type SupabaseAdmin = ReturnType<typeof supabaseServer>;

export type UserAccessContext = {
  hasAppUser: boolean;
  orgUnit: string | null;
  schoolNumber: string | null;
  roles: string[];
  isSchulleitung: boolean;
  isSekretariat: boolean;
};

export async function getUserAccessContext(
  authEmail: string,
  supabase: SupabaseAdmin
): Promise<UserAccessContext> {
  try {
    if (!supabase) {
      return {
        hasAppUser: false,
        orgUnit: null,
        schoolNumber: null,
        roles: [],
        isSchulleitung: false,
        isSekretariat: false,
      };
    }

    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, org_unit, school_number')
      .eq('email', authEmail)
      .single();

    if (!appUser) {
      return {
        hasAppUser: false,
        orgUnit: null,
        schoolNumber: null,
        roles: [],
        isSchulleitung: false,
        isSekretariat: false,
      };
    }

    const { data: rolesRows } = await supabase
      .from('user_roles')
      .select('role_code')
      .eq('user_id', appUser.id);

    const roles = (rolesRows ?? []).map((r) => r.role_code as string).filter(Boolean);
    const isSchulleitung = roles.includes('SCHULLEITUNG');
    const isSekretariat = roles.includes('SEKRETARIAT');

    return {
      hasAppUser: true,
      orgUnit: (appUser.org_unit as string | null) ?? null,
      schoolNumber: (appUser.school_number as string | null) ?? null,
      roles,
      isSchulleitung,
      isSekretariat,
    };
  } catch {
    return {
      hasAppUser: false,
      orgUnit: null,
      schoolNumber: null,
      roles: [],
      isSchulleitung: false,
      isSekretariat: false,
    };
  }
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

