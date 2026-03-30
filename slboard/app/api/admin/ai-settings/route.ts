import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../lib/adminAuth';
import { getUserAccessContext } from '../../../../lib/documentAccess';
import { getAiSettingsForSchool } from '../../../../lib/aiSettings';
import { apiError } from '../../../../lib/apiError';

type UpdatePayload = Partial<{
  max_text_per_doc: number;
  chunk_chars: number;
  chunk_overlap_chars: number;
  max_chunks_per_doc: number;
  llm_timeout_ms: number;
  debug_log_enabled: boolean;
  school_profile_text: string;
}>;

export const runtime = 'nodejs';

export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');

    const supabase = supabaseServer();
    if (!supabase) return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const access = await getUserAccessContext(user.email, supabase);
    const settings = await getAiSettingsForSchool(access.schoolNumber);
    const schoolNumber = access.schoolNumber ?? '000000';
    const { data: school } = await supabase
      .from('schools')
      .select('profile_text')
      .eq('school_number', schoolNumber)
      .maybeSingle();
    const school_profile_text = ((school as { profile_text?: string | null } | null)?.profile_text ?? '').trim();
    return NextResponse.json({ settings, school_profile_text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');

    const supabase = supabaseServer();
    if (!supabase) return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const access = await getUserAccessContext(user.email, supabase);
    const schoolNumber = access.schoolNumber ?? '000000';
    const body = (await req.json().catch(() => ({}))) as UpdatePayload;

    const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, Math.floor(n)));
    };

    const next = {
      school_number: schoolNumber,
      max_text_per_doc: clampInt(body.max_text_per_doc, 500, 20000, 4500),
      chunk_chars: clampInt(body.chunk_chars, 500, 8000, 2500),
      chunk_overlap_chars: clampInt(body.chunk_overlap_chars, 0, 2000, 300),
      max_chunks_per_doc: clampInt(body.max_chunks_per_doc, 1, 10, 3),
      llm_timeout_ms: clampInt(body.llm_timeout_ms, 5000, 120000, 45000),
      debug_log_enabled: Boolean(body.debug_log_enabled),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('ai_settings')
      .upsert(next, { onConflict: 'school_number' })
      .select(
        'school_number, max_text_per_doc, chunk_chars, chunk_overlap_chars, max_chunks_per_doc, llm_timeout_ms, debug_log_enabled, updated_at'
      )
      .single();

    if (error || !data) {
      return apiError(500, 'INTERNAL_ERROR', error?.message ?? 'Konnte nicht speichern.');
    }

    const profileText = (body.school_profile_text ?? '').trim();
    const { error: schoolErr } = await supabase
      .from('schools')
      .update({ profile_text: profileText || null })
      .eq('school_number', schoolNumber);
    if (schoolErr) {
      return apiError(500, 'INTERNAL_ERROR', schoolErr.message);
    }

    return NextResponse.json({ settings: data, school_profile_text: profileText });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

