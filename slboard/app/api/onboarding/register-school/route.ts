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

const DEFAULT_DOC_TYPES: Array<{ code: string; label: string; sort_order: number }> = [
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

      // 2a) Metadaten-Optionen für die neue Schule initial befüllen (idempotent)
      try {
        await supabase
          .from('school_document_type_options')
          .upsert(
            DEFAULT_DOC_TYPES.map((t) => ({
              school_number: schoolNumber,
              code: t.code,
              label: t.label,
              sort_order: t.sort_order,
              active: true,
            })),
            { onConflict: 'school_number,code' }
          );
        await supabase
          .from('school_responsible_unit_options')
          .upsert(
            DEFAULT_RESP_UNITS.map((u) => ({
              school_number: schoolNumber,
              name: u.name,
              sort_order: u.sort_order,
              active: true,
            })),
            { onConflict: 'school_number,name' }
          );
      } catch {
        // best-effort: Schule soll registrierbar bleiben, falls Migrationen noch nicht eingespielt sind
      }

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

      const { error: initialAdminError } = await supabase
        .from('schools')
        .update({ initial_admin_app_user_id: appUser.id })
        .eq('school_number', schoolNumber);
      if (initialAdminError) throw new Error(initialAdminError.message);
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

