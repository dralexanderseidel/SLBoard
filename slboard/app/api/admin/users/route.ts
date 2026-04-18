import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../lib/adminAuth';
import { resolveUserAccess } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';
import { ensureAuthCredentials } from '../../../../lib/authAdminUsers';

export async function GET() {
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
    const adminSchool = access.schoolNumber ?? null;

    let usersQuery = supabase
      .from('app_users')
      .select('id, username, full_name, email, org_unit, school_number, created_at, password_change_required')
      .order('username');
    if (adminSchool) usersQuery = usersQuery.eq('school_number', adminSchool);
    const { data: users, error } = await usersQuery;

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    const userList = users ?? [];
    const userIds = userList.map((u) => u.id);
    const schoolNumbers = [...new Set(userList.map((u) => u.school_number).filter((sn): sn is string => Boolean(sn)))];

    const [schoolRows, rolesRows] = await Promise.all([
      schoolNumbers.length > 0
        ? supabase.from('schools').select('school_number, initial_admin_app_user_id').in('school_number', schoolNumbers).then((r) => r.data)
        : Promise.resolve([] as { school_number: string; initial_admin_app_user_id?: string | null }[]),
      userIds.length > 0
        ? supabase.from('user_roles').select('user_id, role_code').in('user_id', userIds).then((r) => r.data)
        : Promise.resolve([] as { user_id: string; role_code: string }[]),
    ]);

    const initialBySchool = new Map(
      (schoolRows ?? []).map((s) => [
        s.school_number as string,
        (s as { initial_admin_app_user_id?: string | null }).initial_admin_app_user_id ?? null,
      ])
    );

    const rolesByUser = (rolesRows ?? []).reduce<Record<string, string[]>>((acc, r) => {
      if (!acc[r.user_id]) acc[r.user_id] = [];
      acc[r.user_id].push(r.role_code);
      return acc;
    }, {});

    const usersWithRoles = userList.map((u) => {
      const initialId = u.school_number ? initialBySchool.get(u.school_number) : null;
      const isInitialSchoolAdmin = Boolean(u.school_number && initialId === u.id);
      return {
        ...u,
        roles: rolesByUser[u.id] ?? [],
        deletable: !isInitialSchoolAdmin,
      };
    });

    return NextResponse.json({
      users: usersWithRoles,
      /** Wenn gesetzt, darf der Admin nur Nutzer für diese Schule anlegen (UI + POST erzwingen). */
      createUserSchoolNumber: access.schoolNumber ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

export async function POST(req: NextRequest) {
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
    const adminSchool = access.schoolNumber ?? null;

    const body = await req.json();
    const username = (body.username as string)?.trim();
    const fullName = (body.full_name as string)?.trim();
    const email = (body.email as string)?.trim().toLowerCase();
    const orgUnit = (body.org_unit as string)?.trim();

    if (!username || !fullName || !email || !orgUnit) {
      return apiError(400, 'VALIDATION_ERROR', 'username, full_name, email und org_unit sind Pflichtfelder.');
    }

    const requestedSchool = (body.school_number as string | undefined)?.trim() ?? '';
    let schoolNumber: string;
    if (adminSchool) {
      if (requestedSchool && requestedSchool !== adminSchool) {
        return apiError(403, 'FORBIDDEN', 'Sie können nur Nutzer für Ihre eigene Schule anlegen.');
      }
      schoolNumber = adminSchool;
    } else {
      schoolNumber = requestedSchool;
      if (!schoolNumber) {
        return apiError(400, 'VALIDATION_ERROR', 'school_number ist erforderlich.');
      }
    }
    if (!/^\d{6}$/.test(schoolNumber)) {
      return apiError(400, 'VALIDATION_ERROR', 'school_number muss 6-stellig sein.');
    }

    // Nutzer-Quota prüfen (parallel: Quota-Wert + aktuelle Anzahl)
    const [schoolQuotaRes, userCountRes] = await Promise.all([
      supabase
        .from('schools')
        .select('quota_max_users')
        .eq('school_number', schoolNumber)
        .single(),
      supabase
        .from('app_users')
        .select('id', { count: 'exact', head: true })
        .eq('school_number', schoolNumber),
    ]);
    const quotaMaxUsers = (schoolQuotaRes.data as { quota_max_users?: number | null } | null)?.quota_max_users ?? null;
    const currentUserCount = userCountRes.count ?? 0;
    if (quotaMaxUsers !== null && currentUserCount >= quotaMaxUsers) {
      return apiError(
        429,
        'QUOTA_EXCEEDED',
        `Nutzer-Quota erreicht (${currentUserCount} / ${quotaMaxUsers}). Erhöhen Sie die Quota im Super-Admin-Bereich.`
      );
    }

    const { data: newUser, error } = await supabase
      .from('app_users')
      .insert({ username, full_name: fullName, email, org_unit: orgUnit, school_number: schoolNumber })
      .select('id, username, full_name, email, org_unit, school_number, created_at')
      .single();

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    const tempPwd = (body.temporary_password as string | undefined)?.trim() ?? '';
    if (tempPwd) {
      try {
        await ensureAuthCredentials(supabase, {
          email,
          password: tempPwd,
          schoolNumber,
          requirePasswordChange: true,
        });
      } catch (e) {
        await supabase.from('app_users').delete().eq('id', newUser.id);
        const msg = e instanceof Error ? e.message : 'Auth konnte nicht angelegt werden.';
        return apiError(500, 'INTERNAL_ERROR', msg);
      }
    }

    return NextResponse.json({ user: { ...newUser, roles: [], deletable: true } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
