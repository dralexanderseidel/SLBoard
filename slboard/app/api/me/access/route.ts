import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { resolveUserAccess } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';
import { isSuperAdmin } from '../../../../lib/superAdminAuth';
import {
  type SchoolFeatureFlags,
  PLATFORM_DEFAULT_MAX_UPLOAD_MB,
  effectiveMaxUploadBytes,
} from '../../../../lib/schoolFeatureFlags';

export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    const access = await resolveUserAccess(user.email, supabase);
    const superAdmin = await isSuperAdmin(user.email, supabase);
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

    const effectiveMaxUploadMb =
      schoolFeatures.max_upload_file_mb ?? PLATFORM_DEFAULT_MAX_UPLOAD_MB;

    return NextResponse.json({
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}

