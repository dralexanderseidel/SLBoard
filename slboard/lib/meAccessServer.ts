import { createServerSupabaseClient } from './supabaseServerClient';
import { supabaseServer } from './supabaseServer';
import { resolveUserAccess } from './documentAccess';
import { isSuperAdmin } from './superAdminAuth';
import {
  type SchoolFeatureFlags,
  PLATFORM_DEFAULT_MAX_UPLOAD_MB,
  effectiveMaxUploadBytes,
} from './schoolFeatureFlags';
import {
  type HeaderMeAccess,
  type MeAccessApiPayload,
  headerMeAccessFromApiPayload,
} from './meAccessApi';

export async function buildMeAccessApiPayload(authEmail: string): Promise<MeAccessApiPayload | null> {
  const supabase = supabaseServer();
  if (!supabase) return null;

  const [access, superAdmin] = await Promise.all([
    resolveUserAccess(authEmail, supabase),
    isSuperAdmin(authEmail, supabase),
  ]);

  let schoolName: string | null = null;
  let schoolFeatures: SchoolFeatureFlags = {
    feature_ai_enabled: true,
    feature_drafts_enabled: true,
    max_upload_file_mb: null,
  };

  if (access.schoolNumber) {
    const { data: school } = await supabase
      .from('schools')
      .select('name, feature_ai_enabled, feature_drafts_enabled, max_upload_file_mb')
      .eq('school_number', access.schoolNumber)
      .maybeSingle();
    schoolName = (school?.name as string | undefined) ?? null;
    if (school) {
      const s = school as {
        feature_ai_enabled?: boolean | null;
        feature_drafts_enabled?: boolean | null;
        max_upload_file_mb?: number | null;
      };
      schoolFeatures = {
        feature_ai_enabled: s.feature_ai_enabled !== false,
        feature_drafts_enabled: s.feature_drafts_enabled !== false,
        max_upload_file_mb:
          s.max_upload_file_mb != null && Number.isFinite(Number(s.max_upload_file_mb))
            ? Math.min(Math.max(1, Math.floor(Number(s.max_upload_file_mb))), 100)
            : null,
      };
    }
  }

  const effectiveMaxUploadMb = schoolFeatures.max_upload_file_mb ?? PLATFORM_DEFAULT_MAX_UPLOAD_MB;

  return {
    schoolNumber: access.schoolNumber,
    schoolName,
    orgUnit: access.orgUnit,
    roles: access.roles,
    superAdmin,
    accountInactive: access.accountInactive === true,
    featureAiEnabled: schoolFeatures.feature_ai_enabled,
    featureDraftsEnabled: schoolFeatures.feature_drafts_enabled,
    maxUploadFileMb: schoolFeatures.max_upload_file_mb,
    effectiveMaxUploadMb,
    effectiveMaxUploadBytes: effectiveMaxUploadBytes(schoolFeatures),
  };
}

/** Für RSC-Layout: Session + Zugriff in einem Rutsch (ohne Client-Roundtrip). */
export async function getHeaderAccessBootstrap(): Promise<{
  accessPreloaded: boolean;
  initialUserEmail: string | null;
  initialAccess: HeaderMeAccess | null;
}> {
  const client = await createServerSupabaseClient();
  if (!client) {
    return { accessPreloaded: true, initialUserEmail: null, initialAccess: null };
  }

  const { data: { user } } = await client.auth.getUser();
  const email = user?.email?.trim() ?? null;
  if (!email) {
    return { accessPreloaded: true, initialUserEmail: null, initialAccess: null };
  }

  const payload = await buildMeAccessApiPayload(email);
  if (!payload) {
    return { accessPreloaded: true, initialUserEmail: email, initialAccess: null };
  }

  return {
    accessPreloaded: true,
    initialUserEmail: email,
    initialAccess: headerMeAccessFromApiPayload(payload),
  };
}
