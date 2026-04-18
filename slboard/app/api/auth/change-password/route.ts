import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { apiError } from '../../../../lib/apiError';
import { getActiveSchoolNumberFromCookies, normalizeAuthEmail } from '../../../../lib/schoolSession';
import { MIN_APP_PASSWORD_LENGTH } from '../../../../lib/authPasswordConstants';

/**
 * Prüft das bisherige Passwort (Anon-Client, isoliert) und setzt danach
 * `auth.updateUser` über die laufende Session. Kein `admin.updateUser` für
 * das Passwort – der Admin-Pfad würde oft alle Sessions invalidieren.
 * DB-Flag + Metadaten werden abgeschlossen, RPC setzt `password_change_required` zurück.
 */
export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const {
      data: { user },
    } = (await client?.auth.getUser()) ?? { data: { user: null } };
    if (!client) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Sitzung konnte nicht verarbeitet werden.');
    }
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    const schoolNumber = (await getActiveSchoolNumberFromCookies())?.trim() ?? '';
    if (!/^\d{6}$/.test(schoolNumber)) {
      return apiError(400, 'VALIDATION_ERROR', 'Keine aktive Schulnummer (bitte erneut anmelden).');
    }

    const { data: appRow } = await supabase
      .from('app_users')
      .select('id')
      .eq('email', normalizeAuthEmail(user.email))
      .eq('school_number', schoolNumber)
      .maybeSingle();
    if (!appRow) {
      return apiError(403, 'FORBIDDEN', 'Kein Benutzerkonto für diese Schulnummer.');
    }

    const body = (await req.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const currentPassword = (body.currentPassword ?? '').toString();
    const newPassword = (body.newPassword ?? '').toString().trim();
    if (!currentPassword) {
      return apiError(400, 'VALIDATION_ERROR', 'Aktuelles Passwort ist erforderlich.');
    }
    if (!newPassword) {
      return apiError(400, 'VALIDATION_ERROR', 'Neues Passwort ist erforderlich.');
    }
    if (newPassword.length < MIN_APP_PASSWORD_LENGTH) {
      return apiError(
        400,
        'VALIDATION_ERROR',
        `Neues Passwort muss mindestens ${MIN_APP_PASSWORD_LENGTH} Zeichen haben.`,
      );
    }
    if (newPassword === currentPassword) {
      return apiError(400, 'VALIDATION_ERROR', 'Das neue Passwort muss sich vom bisherigen unterscheiden.');
    }

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
    const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
    if (!supabaseUrl || !supabaseAnonKey) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Supabase ist nicht konfiguriert.');
    }

    const verify = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: verifyErr } = await verify.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyErr) {
      return apiError(401, 'AUTH_INVALID', 'Aktuelles Passwort ist nicht korrekt.');
    }

    const prevMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const { error: updErr } = await client.auth.updateUser({
      password: newPassword,
      data: {
        ...prevMeta,
        school_number: schoolNumber,
        password_change_required: false,
      },
    });
    if (updErr) {
      return apiError(500, 'INTERNAL_ERROR', updErr.message);
    }

    const { error: rpcErr } = await supabase.rpc('clear_user_password_change_required', {
      p_email: user.email,
      p_school: schoolNumber,
    });
    if (rpcErr) {
      return apiError(500, 'INTERNAL_ERROR', rpcErr.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
