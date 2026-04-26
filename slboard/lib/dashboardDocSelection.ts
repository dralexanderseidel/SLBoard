/** Deep-Link ?docs=… für KI-Kontext auf der Startseite (max. Länge wegen URL-Limit). */

export const DASHBOARD_DOCS_QUERY_MAX = 25;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseDashboardDocsQueryParam(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((id) => UUID_RE.test(id));
  return [...new Set(ids)].slice(0, DASHBOARD_DOCS_QUERY_MAX);
}

/** Pfad inkl. Query für Navigation von /documents zur Startseite mit Dokumentkontext. */
export function buildDashboardDocsHref(ids: string[]): string {
  const unique = [...new Set(ids.filter((x) => typeof x === 'string' && x.length > 0))].slice(
    0,
    DASHBOARD_DOCS_QUERY_MAX,
  );
  if (unique.length === 0) return '/';
  return `/?docs=${unique.join(',')}`;
}
