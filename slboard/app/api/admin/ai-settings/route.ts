import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../lib/adminAuth';
import { getUserAccessContext } from '../../../../lib/documentAccess';
import { getAiSettingsForSchool } from '../../../../lib/aiSettings';

type UpdatePayload = Partial<{
  max_text_per_doc: number;
  chunk_chars: number;
  chunk_overlap_chars: number;
  max_chunks_per_doc: number;
  debug_log_enabled: boolean;
}>;

export const runtime = 'nodejs';

export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });

    const supabase = supabaseServer();
    if (!supabase) return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    if (!(await isAdmin(user.email, supabase))) {
      return NextResponse.json({ error: 'Keine Admin-Berechtigung.' }, { status: 403 });
    }

    const access = await getUserAccessContext(user.email, supabase);
    const settings = await getAiSettingsForSchool(access.schoolNumber);
    return NextResponse.json({ settings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });

    const supabase = supabaseServer();
    if (!supabase) return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    if (!(await isAdmin(user.email, supabase))) {
      return NextResponse.json({ error: 'Keine Admin-Berechtigung.' }, { status: 403 });
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
      debug_log_enabled: Boolean(body.debug_log_enabled),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('ai_settings')
      .upsert(next, { onConflict: 'school_number' })
      .select(
        'school_number, max_text_per_doc, chunk_chars, chunk_overlap_chars, max_chunks_per_doc, debug_log_enabled, updated_at'
      )
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Konnte nicht speichern.' }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

