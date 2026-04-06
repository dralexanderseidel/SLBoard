import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SCHOOL_DOC_TYPES: Array<{ code: string; label: string; sort_order: number }> = [
  { code: 'PROTOKOLL', label: 'Protokoll', sort_order: 10 },
  { code: 'BESCHLUSSVORLAGE', label: 'Beschlussvorlage', sort_order: 20 },
  { code: 'KONZEPT', label: 'Konzept', sort_order: 30 },
  { code: 'CURRICULUM', label: 'Curriculum', sort_order: 40 },
  { code: 'VEREINBARUNG', label: 'Vereinbarung', sort_order: 50 },
  { code: 'ELTERNBRIEF', label: 'Elternbrief', sort_order: 60 },
  { code: 'RUNDSCHREIBEN', label: 'Rundschreiben', sort_order: 70 },
  { code: 'SITUATIVE_REGELUNG', label: 'Situative Regelung', sort_order: 80 },
];

export const DEFAULT_SCHOOL_RESP_UNITS: Array<{ name: string; sort_order: number }> = [
  { name: 'Schulleitung', sort_order: 10 },
  { name: 'Sekretariat', sort_order: 20 },
  { name: 'Fachschaft Deutsch', sort_order: 30 },
  { name: 'Fachschaft Mathematik', sort_order: 40 },
  { name: 'Fachschaft Englisch', sort_order: 50 },
  { name: 'Steuergruppe', sort_order: 60 },
  { name: 'Lehrkräfte', sort_order: 70 },
];

export type SchoolQuotasInput = {
  quota_max_users?: number | null;
  quota_max_documents?: number | null;
  quota_max_ai_queries_per_month?: number | null;
};

export type ProvisionSchoolParams = {
  schoolNumber: string;
  schoolName: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  quotas?: SchoolQuotasInput | null;
};

function usernameFromEmail(email: string): string {
  return (email.split('@')[0] ?? 'admin').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'admin';
}

function normalizeQuota(n: unknown): number | null | undefined {
  if (n === null || n === undefined || n === '') return n === null ? null : undefined;
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return undefined;
  return Math.floor(v);
}

/**
 * Legt Schule, Schuladmin (Auth + app_users + SCHULLEITUNG) und initial_admin_app_user_id an.
 * Bei Fehlern nach Auth-User-Erstellung wird der Auth-User wieder gelöscht.
 */
export async function provisionSchoolAndAdmin(
  supabase: SupabaseClient,
  params: ProvisionSchoolParams
): Promise<{ schoolNumber: string; appUserId: string }> {
  const schoolNumber = params.schoolNumber.trim();
  const schoolName = params.schoolName.trim();
  const adminFullName = params.adminFullName.trim();
  const adminEmail = params.adminEmail.trim().toLowerCase();
  const adminPassword = params.adminPassword;

  const qIn = params.quotas ?? null;
  const quota_max_users = qIn ? normalizeQuota(qIn.quota_max_users) : undefined;
  const quota_max_documents = qIn ? normalizeQuota(qIn.quota_max_documents) : undefined;
  const quota_max_ai_queries_per_month = qIn ? normalizeQuota(qIn.quota_max_ai_queries_per_month) : undefined;

  const { data: createdAuth, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      school_number: schoolNumber,
    },
  });
  if (authError || !createdAuth.user) {
    throw new Error(authError?.message ?? 'Schuladmin konnte nicht erstellt werden.');
  }

  try {
    const schoolInsert: Record<string, unknown> = {
      school_number: schoolNumber,
      name: schoolName,
      active: true,
    };
    if (quota_max_users !== undefined) schoolInsert.quota_max_users = quota_max_users;
    if (quota_max_documents !== undefined) schoolInsert.quota_max_documents = quota_max_documents;
    if (quota_max_ai_queries_per_month !== undefined) {
      schoolInsert.quota_max_ai_queries_per_month = quota_max_ai_queries_per_month;
    }

    const { error: schoolError } = await supabase.from('schools').insert(schoolInsert);
    if (schoolError) throw new Error(schoolError.message);

    try {
      await supabase.from('school_document_type_options').upsert(
        DEFAULT_SCHOOL_DOC_TYPES.map((t) => ({
          school_number: schoolNumber,
          code: t.code,
          label: t.label,
          sort_order: t.sort_order,
          active: true,
        })),
        { onConflict: 'school_number,code' }
      );
      await supabase.from('school_responsible_unit_options').upsert(
        DEFAULT_SCHOOL_RESP_UNITS.map((u) => ({
          school_number: schoolNumber,
          name: u.name,
          sort_order: u.sort_order,
          active: true,
        })),
        { onConflict: 'school_number,name' }
      );
    } catch {
      // best-effort
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

    const appUserId = (appUser as { id: string }).id;

    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: appUserId, role_code: 'SCHULLEITUNG' });
    if (roleError) throw new Error(roleError.message);

    const { error: initialAdminError } = await supabase
      .from('schools')
      .update({ initial_admin_app_user_id: appUserId })
      .eq('school_number', schoolNumber);
    if (initialAdminError) throw new Error(initialAdminError.message);

    return { schoolNumber, appUserId };
  } catch (e) {
    await supabase.auth.admin.deleteUser(createdAuth.user.id).catch(() => {});
    throw e instanceof Error ? e : new Error('Schule konnte nicht angelegt werden.');
  }
}
