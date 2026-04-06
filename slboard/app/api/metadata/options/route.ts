import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { resolveUserAccess } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';

export const runtime = 'nodejs';

const DEFAULT_TYPES: Array<{ code: string; label: string; sort_order: number }> = [
  { code: 'PROTOKOLL', label: 'Protokoll', sort_order: 10 },
  { code: 'BESCHLUSSVORLAGE', label: 'Beschlussvorlage', sort_order: 20 },
  { code: 'KONZEPT', label: 'Konzept', sort_order: 30 },
  { code: 'CURRICULUM', label: 'Curriculum', sort_order: 40 },
  { code: 'VEREINBARUNG', label: 'Vereinbarung', sort_order: 50 },
  { code: 'ELTERNBRIEF', label: 'Elternbrief', sort_order: 60 },
  { code: 'RUNDSCHREIBEN', label: 'Rundschreiben', sort_order: 70 },
  { code: 'SITUATIVE_REGELUNG', label: 'Situative Regelung', sort_order: 80 },
];

const DEFAULT_RESP_UNITS: Array<{ name: string; sort_order: number }> = [
  { name: 'Schulleitung', sort_order: 10 },
  { name: 'Sekretariat', sort_order: 20 },
  { name: 'Fachschaft Deutsch', sort_order: 30 },
  { name: 'Fachschaft Mathematik', sort_order: 40 },
  { name: 'Fachschaft Englisch', sort_order: 50 },
  { name: 'Steuergruppe', sort_order: 60 },
  { name: 'Lehrkräfte', sort_order: 70 },
];

export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = (await client?.auth.getUser()) ?? { data: { user: null } };
    if (!user?.email) return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');

    const supabase = supabaseServer();
    if (!supabase) return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');

    const access = await resolveUserAccess(user.email, supabase);
    const schoolNumber = access.schoolNumber ?? '000000';

    const [typesRes, unitsRes] = await Promise.all([
      supabase
        .from('school_document_type_options')
        .select('code, label, sort_order, active')
        .eq('school_number', schoolNumber)
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('school_responsible_unit_options')
        .select('name, sort_order, active')
        .eq('school_number', schoolNumber)
        .eq('active', true)
        .order('sort_order', { ascending: true }),
    ]);

    const types = (typesRes.data ?? []).map((t) => ({
      code: (t as { code: string }).code,
      label: (t as { label: string }).label,
    }));
    const responsibleUnits = (unitsRes.data ?? []).map((u) => (u as { name: string }).name);

    // Fallback: falls die Tabellen/Migrationen noch nicht vorhanden sind oder leer sind
    const outTypes = types.length > 0 ? types : DEFAULT_TYPES.map(({ code, label }) => ({ code, label }));
    const outUnits = responsibleUnits.length > 0 ? responsibleUnits : DEFAULT_RESP_UNITS.map((u) => u.name);

    return NextResponse.json({ documentTypes: outTypes, responsibleUnits: outUnits, schoolNumber });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

