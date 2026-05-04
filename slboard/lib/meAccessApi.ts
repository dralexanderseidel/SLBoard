/**
 * Reine Typen + Mapping für /api/me/access und HeaderAccessProvider.
 * Keine Server-Imports — darf von Client-Komponenten importiert werden.
 */

export type HeaderMeAccess = {
  schoolNumber: string | null;
  schoolName: string | null;
  orgUnit: string | null;
  roles: string[];
  superAdmin: boolean;
  accountInactive: boolean;
  featureAiEnabled: boolean;
  featureDraftsEnabled: boolean;
  effectiveMaxUploadBytes: number;
};

export type MeAccessApiPayload = {
  schoolNumber: string | null;
  schoolName: string | null;
  orgUnit: string | null;
  roles: string[];
  superAdmin: boolean;
  accountInactive: boolean;
  featureAiEnabled: boolean;
  featureDraftsEnabled: boolean;
  maxUploadFileMb: number | null;
  effectiveMaxUploadMb: number;
  effectiveMaxUploadBytes: number;
};

export function headerMeAccessFromApiPayload(data: MeAccessApiPayload): HeaderMeAccess {
  const effBytes =
    typeof data.effectiveMaxUploadBytes === 'number' && data.effectiveMaxUploadBytes > 0
      ? data.effectiveMaxUploadBytes
      : 20 * 1024 * 1024;
  return {
    schoolNumber: data.schoolNumber ?? null,
    schoolName: data.schoolName ?? null,
    orgUnit: data.orgUnit ?? null,
    roles: Array.isArray(data.roles) ? data.roles : [],
    superAdmin: !!data.superAdmin,
    accountInactive: !!data.accountInactive,
    featureAiEnabled: data.featureAiEnabled !== false,
    featureDraftsEnabled: data.featureDraftsEnabled !== false,
    effectiveMaxUploadBytes: effBytes,
  };
}
