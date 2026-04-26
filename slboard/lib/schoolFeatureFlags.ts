import type { SupabaseClient } from '@supabase/supabase-js';
import { apiError } from './apiError';

/** Wenn die Schule kein Limit setzt (NULL in DB). */
export const PLATFORM_DEFAULT_MAX_UPLOAD_MB = 20;

/** Obergrenze für Super-Admin-Eingabe (und Clamp). */
export const PLATFORM_MAX_UPLOAD_MB_CAP = 100;

export type SchoolFeatureFlags = {
  feature_ai_enabled: boolean;
  feature_drafts_enabled: boolean;
  max_upload_file_mb: number | null;
};

const DEFAULT_FLAGS: SchoolFeatureFlags = {
  feature_ai_enabled: true,
  feature_drafts_enabled: true,
  max_upload_file_mb: null,
};

function normalizeMaxUploadMbColumn(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 1) return null;
  return Math.min(i, PLATFORM_MAX_UPLOAD_MB_CAP);
}

/**
 * Lädt Feature-Flags für eine Schulnummer. Bei unbekannter/fehlender Schule: alles aktiv (Default).
 */
export async function loadSchoolFeatureFlags(
  supabase: SupabaseClient,
  schoolNumber: string | null | undefined
): Promise<SchoolFeatureFlags> {
  const sn = (schoolNumber ?? '').trim();
  if (!/^\d{6}$/.test(sn)) {
    return { ...DEFAULT_FLAGS };
  }

  const { data, error } = await supabase
    .from('schools')
    .select('feature_ai_enabled, feature_drafts_enabled, max_upload_file_mb')
    .eq('school_number', sn)
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_FLAGS };
  }

  const row = data as {
    feature_ai_enabled?: boolean | null;
    feature_drafts_enabled?: boolean | null;
    max_upload_file_mb?: number | null;
  };

  return {
    feature_ai_enabled: row.feature_ai_enabled !== false,
    feature_drafts_enabled: row.feature_drafts_enabled !== false,
    max_upload_file_mb: normalizeMaxUploadMbColumn(row.max_upload_file_mb),
  };
}

/** Effektive Maximalgröße in Bytes für Upload / neue Version. */
export function effectiveMaxUploadBytes(flags: SchoolFeatureFlags): number {
  const mb = flags.max_upload_file_mb ?? PLATFORM_DEFAULT_MAX_UPLOAD_MB;
  const clamped = Math.min(Math.max(1, mb), PLATFORM_MAX_UPLOAD_MB_CAP);
  return clamped * 1024 * 1024;
}

/** Für Super-Admin PATCH: Zahl 1–100 oder null (Default). */
export function parseSuperAdminMaxUploadMbInput(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i < 1 || i > PLATFORM_MAX_UPLOAD_MB_CAP) return undefined;
  return i;
}

export function apiResponseIfAiDisabled(flags: SchoolFeatureFlags) {
  if (!flags.feature_ai_enabled) {
    return apiError(
      403,
      'FEATURE_AI_DISABLED',
      'KI-Funktionen sind für diese Schule deaktiviert. Bitte wenden Sie sich an den Plattform-Administrator.'
    );
  }
  return null;
}

export function apiResponseIfDraftsDisabled(flags: SchoolFeatureFlags) {
  if (!flags.feature_drafts_enabled) {
    return apiError(
      403,
      'FEATURE_DRAFTS_DISABLED',
      'Der Entwurfsassistent ist für diese Schule deaktiviert. Bitte wenden Sie sich an den Plattform-Administrator.'
    );
  }
  return null;
}
