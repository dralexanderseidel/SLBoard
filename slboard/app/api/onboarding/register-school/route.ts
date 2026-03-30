import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { apiError } from '../../../../lib/apiError';

type RegisterSchoolPayload = {
  schoolNumber?: string;
  schoolName?: string;
  adminFullName?: string;
  adminEmail?: string;
  adminPassword?: string;
};

function usernameFromEmail(email: string): string {
  return (email.split('@')[0] ?? 'admin').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'admin';
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterSchoolPayload;
    const schoolNumber = (body.schoolNumber ?? '').trim();
    const schoolName = (body.schoolName ?? '').trim();
    const adminFullName = (body.adminFullName ?? '').trim();
    const adminEmail = (body.adminEmail ?? '').trim().toLowerCase();
    const adminPassword = body.adminPassword ?? '';

    if (!/^\d{6}$/.test(schoolNumber)) {
      return apiError(400, 'VALIDATION_ERROR', 'Schulnummer muss 6-stellig sein.');
    }
    if (!schoolName) {
      return apiError(400, 'VALIDATION_ERROR', 'Schulname ist erforderlich.');
    }
    if (!adminFullName) {
      return apiError(400, 'VALIDATION_ERROR', 'Name des Schuladmins ist erforderlich.');
    }
    if (!adminEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
      return apiError(400, 'VALIDATION_ERROR', 'Gültige Admin-E-Mail ist erforderlich.');
    }
    if (!adminPassword || adminPassword.length < 10) {
      return apiError(400, 'VALIDATION_ERROR', 'Passwort muss mindestens 10 Zeichen haben.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    const { data: existingSchool } = await supabase
      .from('schools')
      .select('school_number')
      .eq('school_number', schoolNumber)
      .maybeSingle();
    if (existingSchool) {
      return apiError(409, 'BAD_REQUEST', 'Diese Schule ist bereits registriert.');
    }

    // 1) Auth-User erstellen
    const { data: createdAuth, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        school_number: schoolNumber,
      },
    });
    if (authError || !createdAuth.user) {
      return apiError(500, 'INTERNAL_ERROR', authError?.message ?? 'Schuladmin konnte nicht erstellt werden.');
    }

    // 2) Schule + app_user + Rolle anlegen (bei Fehler Auth-User aufräumen)
    try {
      const { error: schoolError } = await supabase
        .from('schools')
        .insert({ school_number: schoolNumber, name: schoolName, active: true });
      if (schoolError) throw new Error(schoolError.message);

      const { data: appUser, error: appUserError } = await supabase
        .from('app_users')
        .insert({
          username: usernameFromEmail(adminEmail),
          full_name: adminFullName,
          email: adminEmail,
          org_unit: 'Schulleitung',
          school_number: schoolNumber,
        })
        .select('id')
        .single();
      if (appUserError || !appUser) throw new Error(appUserError?.message ?? 'app_user konnte nicht erstellt werden.');

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: appUser.id, role_code: 'SCHULLEITUNG' });
      if (roleError) throw new Error(roleError.message);
    } catch (e) {
      await supabase.auth.admin.deleteUser(createdAuth.user.id).catch(() => {});
      return apiError(500, 'INTERNAL_ERROR', e instanceof Error ? e.message : 'Schule konnte nicht registriert werden.');
    }

    return NextResponse.json({
      ok: true,
      schoolNumber,
      message: 'Schule und Schuladmin wurden erfolgreich registriert.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}

