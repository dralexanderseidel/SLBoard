import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../../lib/adminAuth';
import { canAccessSchool, resolveUserAccess } from '../../../../../lib/documentAccess';
import { apiError } from '../../../../../lib/apiError';
import { ensureAuthCredentials } from '../../../../../lib/authAdminUsers';

async function deleteAuthUserByEmail(
  supabase: NonNullable<ReturnType<typeof supabaseServer>>,
  email: string
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const perPage = 200;
  for (let p = 1; p <= 50; p++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: p, perPage });
    if (error) {
      console.warn('[admin delete user] auth listUsers:', error.message);
      return;
    }
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === normalized);
    if (found?.id) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(found.id);
      if (delErr) console.warn('[admin delete user] auth deleteUser:', delErr.message);
      return;
    }
    if (data.users.length < perPage) break;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const access = await resolveUserAccess(user.email, supabase);
    const { id } = await params;

    const { data: currentApp } = await supabase
      .from('app_users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();
    if (currentApp && (currentApp as { id: string }).id === id) {
      return apiError(403, 'FORBIDDEN', 'Sie können sich nicht selbst löschen.');
    }

    const { data: target, error: targetErr } = await supabase
      .from('app_users')
      .select('id, email, school_number')
      .eq('id', id)
      .single();

    if (targetErr || !target) {
      return apiError(404, 'NOT_FOUND', 'Nutzer nicht gefunden.');
    }

    const targetSchool = (target as { school_number?: string | null }).school_number ?? null;
    if (!canAccessSchool(access, targetSchool)) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für diesen Nutzer.');
    }

    if (targetSchool) {
      const { data: schoolRow } = await supabase
        .from('schools')
        .select('initial_admin_app_user_id')
        .eq('school_number', targetSchool)
        .maybeSingle();
      const initialId = (schoolRow as { initial_admin_app_user_id?: string | null } | null)
        ?.initial_admin_app_user_id;
      if (initialId === id) {
        return apiError(
          403,
          'FORBIDDEN',
          'Der bei der Schulregistrierung angelegte Admin-Account kann nicht gelöscht werden.'
        );
      }
    }

    const targetEmail = (target as { email: string }).email;
    const { error: delErr } = await supabase.from('app_users').delete().eq('id', id);
    if (delErr) {
      return apiError(500, 'INTERNAL_ERROR', delErr.message);
    }

    await deleteAuthUserByEmail(supabase, targetEmail);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const access = await resolveUserAccess(user.email, supabase);

    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, string> = {};
    if (typeof body.username === 'string' && body.username.trim()) updates.username = body.username.trim();
    if (typeof body.full_name === 'string' && body.full_name.trim()) updates.full_name = body.full_name.trim();
    if (typeof body.email === 'string' && body.email.trim()) {
      updates.email = body.email.trim().toLowerCase();
    }
    if (typeof body.org_unit === 'string' && body.org_unit.trim()) updates.org_unit = body.org_unit.trim();

    const tempPwd = (body.temporary_password as string | undefined)?.trim() ?? '';

    if (Object.keys(updates).length === 0 && !tempPwd) {
      return apiError(400, 'VALIDATION_ERROR', 'Keine Felder zum Aktualisieren.');
    }

    const { data: target } = await supabase
      .from('app_users')
      .select('id, school_number, email')
      .eq('id', id)
      .single();
    const targetSchool = (target as { school_number?: string | null } | null)?.school_number ?? null;
    const previousEmail = (target as { email?: string } | null)?.email?.trim().toLowerCase() ?? '';
    if (!canAccessSchool(access, targetSchool)) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für diesen Nutzer.');
    }

    if (Object.keys(updates).length > 0) {
      let updateQuery = supabase
        .from('app_users')
        .update(updates)
        .eq('id', id)
        .select('id, username, full_name, email, org_unit, school_number, created_at');
      if (targetSchool) updateQuery = updateQuery.eq('school_number', targetSchool);
      const { data, error } = await updateQuery.single();

      if (error) {
        return apiError(500, 'INTERNAL_ERROR', error.message);
      }

      if (tempPwd) {
        try {
          await ensureAuthCredentials(supabase, {
            email: (data as { email: string }).email,
            password: tempPwd,
            schoolNumber: targetSchool ?? '',
            lookupEmail: previousEmail,
            requirePasswordChange: true,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Passwort konnte nicht gesetzt werden.';
          return apiError(500, 'INTERNAL_ERROR', msg);
        }
      }

      return NextResponse.json({ user: data });
    }

    if (tempPwd) {
      try {
        await ensureAuthCredentials(supabase, {
          email: previousEmail,
          password: tempPwd,
          schoolNumber: targetSchool ?? '',
          requirePasswordChange: true,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Passwort konnte nicht gesetzt werden.';
        return apiError(500, 'INTERNAL_ERROR', msg);
      }
    }

    const { data: refreshed } = await supabase
      .from('app_users')
      .select('id, username, full_name, email, org_unit, school_number, created_at')
      .eq('id', id)
      .single();

    return NextResponse.json({ user: refreshed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
