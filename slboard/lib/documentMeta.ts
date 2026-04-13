/**
 * Zentrale Metadaten-Konstanten für Dokumenttypen, Org-Einheiten und Beteiligungsgruppen.
 * Alle anderen Dateien importieren von hier – keine duplizierten Listen mehr.
 */
import { DEFAULT_SCHOOL_DOC_TYPES, DEFAULT_SCHOOL_RESP_UNITS } from './schoolProvisioning';

export { DEFAULT_SCHOOL_DOC_TYPES, DEFAULT_SCHOOL_RESP_UNITS };

/** Nur die Code-Strings aller Standard-Dokumenttypen. */
export const DOC_TYPE_CODES = DEFAULT_SCHOOL_DOC_TYPES.map((t) => t.code);

/** Standard-Org-Einheiten als einfache String-Liste (Fallback wenn DB-Liste leer). */
export const DEFAULT_ORG_UNIT_NAMES = DEFAULT_SCHOOL_RESP_UNITS.map((u) => u.name);

/** Feste Beteiligungsgruppen-Optionen. */
export const PARTICIPATION_GROUP_OPTIONS = [
  'Schulkonferenz',
  'Lehrerkonferenz',
  'Fachkonferenz',
  'Schülervertretung',
  'Elternvertretung',
  'Steuergruppe',
  'Ganztagsteam',
] as const;

export type ParticipationGroup = (typeof PARTICIPATION_GROUP_OPTIONS)[number];

const DOC_TYPE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  DEFAULT_SCHOOL_DOC_TYPES.map((t) => [t.code, t.label])
);

/**
 * Deutschen Label für einen Dokumenttyp-Code.
 * Optionale dynamische Liste (aus DB) hat Vorrang.
 */
export function docTypeLabelDe(
  code: string,
  dynamicOptions?: Array<{ code: string; label: string }> | null
): string {
  if (dynamicOptions && dynamicOptions.length > 0) {
    const match = dynamicOptions.find((t) => t.code === code);
    if (match) return match.label;
  }
  return DOC_TYPE_LABEL_MAP[code] ?? code;
}
