/** Normalisiert E-Mail für DB-Vergleiche (Edge-Middleware-sicher, kein next/headers). */
export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}
