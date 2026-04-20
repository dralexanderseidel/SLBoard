import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { apiError } from '../../../../lib/apiError';
import { provisionSchoolAndAdmin } from '../../../../lib/schoolProvisioning';

type RegisterSchoolPayload = {
  schoolNumber?: string;
  schoolName?: string;
  adminFullName?: string;
  adminEmail?: string;
  adminPassword?: string;
  privacyAccepted?: boolean;
};

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

    try {
      await provisionSchoolAndAdmin(supabase, {
        schoolNumber,
        schoolName,
        adminFullName,
        adminEmail,
        adminPassword,
        privacyPolicyAcceptedAt: new Date().toISOString(),
      });
    } catch (e) {
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
