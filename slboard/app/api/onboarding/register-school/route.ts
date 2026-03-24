import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';

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
      return NextResponse.json({ error: 'Schulnummer muss 6-stellig sein.' }, { status: 400 });
    }
    if (!schoolName) {
      return NextResponse.json({ error: 'Schulname ist erforderlich.' }, { status: 400 });
    }
    if (!adminFullName) {
      return NextResponse.json({ error: 'Name des Schuladmins ist erforderlich.' }, { status: 400 });
    }
    if (!adminEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
      return NextResponse.json({ error: 'Gültige Admin-E-Mail ist erforderlich.' }, { status: 400 });
    }
    if (!adminPassword || adminPassword.length < 10) {
      return NextResponse.json({ error: 'Passwort muss mindestens 10 Zeichen haben.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    }

    const { data: existingSchool } = await supabase
      .from('schools')
      .select('school_number')
      .eq('school_number', schoolNumber)
      .maybeSingle();
    if (existingSchool) {
      return NextResponse.json({ error: 'Diese Schule ist bereits registriert.' }, { status: 409 });
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
      return NextResponse.json(
        { error: authError?.message ?? 'Schuladmin konnte nicht erstellt werden.' },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Schule konnte nicht registriert werden.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      schoolNumber,
      message: 'Schule und Schuladmin wurden erfolgreich registriert.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

