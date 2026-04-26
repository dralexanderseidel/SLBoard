import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../../lib/supabaseServerClient';
import { isSuperAdmin } from '../../../../../../lib/superAdminAuth';
import { apiError } from '../../../../../../lib/apiError';
import { ensureAuthCredentials } from '../../../../../../lib/authAdminUsers';
import { MIN_APP_PASSWORD_LENGTH } from '../../../../../../lib/authPasswordConstants';

/**
 * Super-Admin: temporäres Passwort für den bei der Schul-Anlage hinterlegten Erst-Admin setzen
 * (Supabase Auth + Kennzeichnung Passwortwechsel), z. B. wenn der Schuladmin das Passwort vergisst.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ schoolNumber: string }> }
) {
  try {
    const client = await createServerSupabaseClient();
    const {
      data: { user },
    } = (await client?.auth.getUser()) ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    if (!(await isSuperAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Super-Admin-Berechtigung.');
    }

    const { schoolNumber: rawSn } = await params;
    const schoolNumber = (rawSn ?? '').trim();
    if (!/^\d{6}$/.test(schoolNumber)) {
      return apiError(400, 'VALIDATION_ERROR', 'Ungültige Schulnummer.');
    }

    const body = (await req.json().catch(() => ({}))) as { temporaryPassword?: string };
    const temporaryPassword = String(body.temporaryPassword ?? '').trim();
    if (temporaryPassword.length < MIN_APP_PASSWORD_LENGTH) {
      return apiError(
        400,
        'VALIDATION_ERROR',
        `Passwort muss mindestens ${MIN_APP_PASSWORD_LENGTH} Zeichen haben.`
      );
    }

    const { data: school, error: schoolErr } = await supabase
      .from('schools')
      .select('initial_admin_app_user_id')
      .eq('school_number', schoolNumber)
      .maybeSingle();

    if (schoolErr) {
      return apiError(500, 'INTERNAL_ERROR', schoolErr.message);
    }
    if (!school) {
      return apiError(404, 'NOT_FOUND', 'Schule nicht gefunden.');
    }

    const adminId = (school as { initial_admin_app_user_id?: string | null }).initial_admin_app_user_id;
    if (!adminId) {
      return apiError(
        400,
        'VALIDATION_ERROR',
        'Für diese Schule ist kein Erst-Admin hinterlegt (initial_admin_app_user_id).'
      );
    }

    const { data: adminRow, error: adminErr } = await supabase
      .from('app_users')
      .select('id, email, school_number')
      .eq('id', adminId)
      .maybeSingle();

    if (adminErr || !adminRow) {
      return apiError(500, 'INTERNAL_ERROR', adminErr?.message ?? 'Erst-Admin nicht gefunden.');
    }

    const rowSchool = String((adminRow as { school_number?: string | null }).school_number ?? '').trim();
    if (rowSchool !== schoolNumber) {
      return apiError(400, 'VALIDATION_ERROR', 'Erst-Admin gehört nicht zu dieser Schulnummer.');
    }

    const email = String((adminRow as { email: string }).email ?? '')
      .trim()
      .toLowerCase();
    if (!email) {
      return apiError(400, 'VALIDATION_ERROR', 'Erst-Admin hat keine E-Mail.');
    }

    try {
      await ensureAuthCredentials(supabase, {
        email,
        password: temporaryPassword,
        schoolNumber,
        requirePasswordChange: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Passwort konnte nicht gesetzt werden.';
      return apiError(500, 'INTERNAL_ERROR', msg);
    }

    return NextResponse.json({
      ok: true,
      message:
        'Neues temporäres Passwort wurde gesetzt. Der Schuladmin muss sich anmelden und das Passwort sofort ändern.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
