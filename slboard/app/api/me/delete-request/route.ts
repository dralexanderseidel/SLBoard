import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { resolveUserAccess } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';

/**
 * Schlanke Löschanfrage: nur Protokolleintrag für Admins (kein automatisches Löschen).
 */
export async function POST() {
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
    if (access.needsSchoolContext) {
      return apiError(403, 'FORBIDDEN', 'Bitte Schul-Kontext setzen (erneut anmelden).');
    }
    if (!access.hasAppUser || !access.appUserId || !access.schoolNumber) {
      return apiError(403, 'FORBIDDEN', 'Kein Schul-Konto für diese Anfrage.');
    }

    const email = user.email.trim().toLowerCase();
    const { error } = await supabase.from('account_delete_requests').insert({
      school_number: access.schoolNumber,
      app_user_id: access.appUserId,
      email,
    });

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    return NextResponse.json({
      ok: true,
      message:
        'Ihre Löschanfrage wurde gespeichert. Die weitere Bearbeitung erfolgt durch einen Administrator; es werden keine Daten automatisch gelöscht.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
