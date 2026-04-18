import type { SupabaseClient } from '@supabase/supabase-js';

const PILOT_SCHOOL = '000000';

export type DeleteSchoolError = { message: string; code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR' };

/**
 * Löscht eine Schule inkl. Schuladmin (Auth + app_users), wenn:
 * – keine Dokumente,
 * – genau ein app_user und dieser entspricht initial_admin_app_user_id,
 * – nicht die Pilotschule 000000.
 * Entfernt zuvor schulspezifische Daten (KI, Audit, …).
 */
export async function deleteSchoolAsSuperAdmin(
  supabase: SupabaseClient,
  schoolNumber: string
): Promise<{ ok: true } | { ok: false; error: DeleteSchoolError }> {
  const sn = schoolNumber.trim();
  if (!/^\d{6}$/.test(sn)) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Ungültige Schulnummer.' } };
  }
  if (sn === PILOT_SCHOOL) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Die Pilotschule (000000) kann nicht gelöscht werden.' },
    };
  }

  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('school_number, initial_admin_app_user_id')
    .eq('school_number', sn)
    .maybeSingle();

  if (schoolErr) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: schoolErr.message } };
  }
  if (!school) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Schule nicht gefunden.' } };
  }

  const initialAdminId = (school as { initial_admin_app_user_id: string | null }).initial_admin_app_user_id;
  if (!initialAdminId) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message:
          'Schule hat keinen verknüpften Erst-Admin (initial_admin_app_user_id). Löschen ist aus Sicherheitsgründen nicht möglich.',
      },
    };
  }

  const { count: docCount, error: docErr } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('school_number', sn);

  if (docErr) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: docErr.message } };
  }
  if ((docCount ?? 0) > 0) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Schule kann nicht gelöscht werden: Es existieren noch Dokumente.',
      },
    };
  }

  const { data: appRows, error: appErr } = await supabase
    .from('app_users')
    .select('id, email')
    .eq('school_number', sn);

  if (appErr) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: appErr.message } };
  }
  const users = appRows ?? [];
  if (users.length !== 1) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Schule kann nur gelöscht werden, wenn genau ein Nutzer (Schuladmin) existiert. Aktuell: ${users.length}.`,
      },
    };
  }
  const only = users[0] as { id: string; email: string };
  if (only.id !== initialAdminId) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message:
          'Schule kann nicht gelöscht werden: Der verbleibende Nutzer ist nicht der hinterlegte Erst-Admin.',
      },
    };
  }

  const adminEmail = (only.email ?? '').trim().toLowerCase();

  const { error: e1 } = await supabase.from('ai_llm_calls').delete().eq('school_number', sn);
  if (e1) return { ok: false, error: { code: 'INTERNAL_ERROR', message: e1.message } };

  const { error: e2 } = await supabase.from('ai_queries').delete().eq('school_number', sn);
  if (e2) return { ok: false, error: { code: 'INTERNAL_ERROR', message: e2.message } };

  const { error: e3 } = await supabase.from('audit_log').delete().eq('school_number', sn);
  if (e3) return { ok: false, error: { code: 'INTERNAL_ERROR', message: e3.message } };

  const { error: e4 } = await supabase.from('document_versions').delete().eq('school_number', sn);
  if (e4) return { ok: false, error: { code: 'INTERNAL_ERROR', message: e4.message } };

  const { error: e5 } = await supabase.from('documents').delete().eq('school_number', sn);
  if (e5) return { ok: false, error: { code: 'INTERNAL_ERROR', message: e5.message } };

  const { error: e6 } = await supabase.from('app_users').delete().eq('id', only.id);
  if (e6) return { ok: false, error: { code: 'INTERNAL_ERROR', message: e6.message } };

  if (adminEmail) {
    try {
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const authUser = (list?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === adminEmail);
      if (authUser?.id) {
        const { error: delAuthErr } = await supabase.auth.admin.deleteUser(authUser.id);
        if (delAuthErr) {
          return {
            ok: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: `Datenbank bereinigt, aber Auth-User konnte nicht gelöscht werden: ${delAuthErr.message}`,
            },
          };
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Auth-Löschung fehlgeschlagen.';
      return { ok: false, error: { code: 'INTERNAL_ERROR', message: msg } };
    }
  }

  const { error: e7 } = await supabase.from('schools').delete().eq('school_number', sn);
  if (e7) return { ok: false, error: { code: 'INTERNAL_ERROR', message: e7.message } };

  return { ok: true };
}
