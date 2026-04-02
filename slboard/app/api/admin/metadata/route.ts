import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { isAdmin } from '../../../../lib/adminAuth';
import { getUserAccessContext } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';

export const runtime = 'nodejs';

type UpdatePayload = {
  documentTypes?: Array<{ code: string; label: string; active?: boolean; sort_order?: number }>;
  responsibleUnits?: Array<{ name: string; active?: boolean; sort_order?: number }>;
};

export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = (await client?.auth.getUser()) ?? { data: { user: null } };
    if (!user?.email) return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');

    const supabase = supabaseServer();
    if (!supabase) return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    if (!(await isAdmin(user.email, supabase))) return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');

    const access = await getUserAccessContext(user.email, supabase);
    const schoolNumber = access.schoolNumber ?? '000000';

    const [typesRes, unitsRes] = await Promise.all([
      supabase
        .from('school_document_type_options')
        .select('code, label, sort_order, active')
        .eq('school_number', schoolNumber)
        .order('sort_order', { ascending: true }),
      supabase
        .from('school_responsible_unit_options')
        .select('name, sort_order, active')
        .eq('school_number', schoolNumber)
        .order('sort_order', { ascending: true }),
    ]);

    return NextResponse.json({
      schoolNumber,
      documentTypes: typesRes.data ?? [],
      responsibleUnits: unitsRes.data ?? [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = (await client?.auth.getUser()) ?? { data: { user: null } };
    if (!user?.email) return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');

    const supabase = supabaseServer();
    if (!supabase) return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    if (!(await isAdmin(user.email, supabase))) return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');

    const access = await getUserAccessContext(user.email, supabase);
    const schoolNumber = access.schoolNumber ?? '000000';

    const body = (await req.json().catch(() => ({}))) as UpdatePayload;
    const docTypes = (body.documentTypes ?? []).filter((t) => t && typeof t.code === 'string' && typeof t.label === 'string');
    const respUnits = (body.responsibleUnits ?? []).filter((u) => u && typeof u.name === 'string');

    const clampInt = (v: unknown, fallback: number) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(0, Math.floor(n));
    };

    if (docTypes.length > 0) {
      const rows = docTypes.map((t, idx) => ({
        school_number: schoolNumber,
        code: t.code.trim(),
        label: t.label.trim(),
        sort_order: clampInt(t.sort_order, idx * 10),
        active: t.active !== false,
        updated_at: new Date().toISOString(),
      })).filter((r) => r.code && r.label);

      const { error } = await supabase
        .from('school_document_type_options')
        .upsert(rows, { onConflict: 'school_number,code' });
      if (error) return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    if (respUnits.length > 0) {
      const rows = respUnits.map((u, idx) => ({
        school_number: schoolNumber,
        name: u.name.trim(),
        sort_order: clampInt(u.sort_order, idx * 10),
        active: u.active !== false,
        updated_at: new Date().toISOString(),
      })).filter((r) => r.name);

      const { error } = await supabase
        .from('school_responsible_unit_options')
        .upsert(rows, { onConflict: 'school_number,name' });
      if (error) return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

