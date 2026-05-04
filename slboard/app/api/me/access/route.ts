import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { buildMeAccessApiPayload } from '../../../../lib/meAccessServer';
import { apiError } from '../../../../lib/apiError';

export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const payload = await buildMeAccessApiPayload(user.email);
    if (!payload) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}

