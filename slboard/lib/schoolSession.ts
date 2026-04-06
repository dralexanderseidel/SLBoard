import { cookies } from 'next/headers';

/** HttpOnly-Cookie: aktive Schulnummer (6 Ziffern) nach Anmeldung */
export const ACTIVE_SCHOOL_COOKIE = 'slb_active_school';

export async function getActiveSchoolNumberFromCookies(): Promise<string | null> {
  try {
    const jar = await cookies();
    const v = jar.get(ACTIVE_SCHOOL_COOKIE)?.value?.trim();
    if (v && /^\d{6}$/.test(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}
