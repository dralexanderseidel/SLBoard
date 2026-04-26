import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { apiError } from '../../../../lib/apiError';
import { ACTIVE_SCHOOL_COOKIE, normalizeAuthEmail } from '../../../../lib/schoolSession';
import { SCHOOL_INACTIVE_API_MESSAGE } from '../../../../lib/schoolInactiveMessages';
import { ACCOUNT_INACTIVE_API_MESSAGE } from '../../../../lib/accountInactiveMessages';

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const {
      data: { user },
    } = (await client?.auth.getUser()) ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const body = (await req.json().catch(() => ({}))) as { schoolNumber?: string };
    const schoolNumber = String(body.schoolNumber ?? '').trim();
    if (!/^\d{6}$/.test(schoolNumber)) {
      return apiError(400, 'VALIDATION_ERROR', 'Schulnummer muss 6-stellig sein.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    // Nutzer-Konto und Schul-Status parallel prüfen
    const [{ data: row }, { data: school }] = await Promise.all([
      supabase
        .from('app_users')
        .select('id, password_change_required, active')
        .eq('email', normalizeAuthEmail(user.email))
        .eq('school_number', schoolNumber)
        .maybeSingle(),
      supabase
        .from('schools')
        .select('active')
        .eq('school_number', schoolNumber)
        .maybeSingle(),
    ]);

    if (!row) {
      return apiError(403, 'FORBIDDEN', 'Kein Benutzerkonto für diese Schulnummer.');
    }
    if ((row as { active?: boolean }).active === false) {
      return apiError(403, 'ACCOUNT_INACTIVE', ACCOUNT_INACTIVE_API_MESSAGE);
    }
    if (school && school.active === false) {
      return apiError(403, 'SCHOOL_INACTIVE', SCHOOL_INACTIVE_API_MESSAGE);
    }

    const passwordChangeRequired = Boolean(
      (row as { password_change_required?: boolean }).password_change_required,
    );

    const prevMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...prevMeta,
        school_number: schoolNumber,
        password_change_required: passwordChangeRequired,
      },
    });
    if (updErr) {
      return apiError(500, 'INTERNAL_ERROR', updErr.message);
    }

    const res = NextResponse.json({ ok: true, passwordChangeRequired });
    res.cookies.set(ACTIVE_SCHOOL_COOKIE, schoolNumber, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 400,
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

export async function DELETE() {
  try {
    const client = await createServerSupabaseClient();
    const {
      data: { user },
    } = (await client?.auth.getUser()) ?? { data: { user: null } };
    if (!user?.email) {
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const supabase = supabaseServer();
    if (supabase) {
      const prevMeta = { ...((user.user_metadata ?? {}) as Record<string, unknown>) };
      delete prevMeta.school_number;
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: prevMeta,
      });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ACTIVE_SCHOOL_COOKIE, '', { maxAge: 0, path: '/' });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
