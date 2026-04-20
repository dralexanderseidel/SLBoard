import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { canReadDocument, resolveUserAccess } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';

/**
 * Auskunft / Datenexport (JSON): Konto- und Schul-Kontext sowie Metadaten zu Dokumenten und KI-Verlauf.
 * Keine Datei-Inhalte, keine Storage-URIs.
 */
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

    const access = await resolveUserAccess(user.email, supabase);
    if (access.needsSchoolContext) {
      return apiError(403, 'FORBIDDEN', 'Bitte Schul-Kontext setzen (erneut anmelden).');
    }
    if (!access.hasAppUser || !access.appUserId || !access.schoolNumber) {
      return apiError(403, 'FORBIDDEN', 'Kein exportierbares Schul-Konto gefunden.');
    }

    const schoolNumber = access.schoolNumber;

    const [{ data: appRow }, { data: schoolRow }, { data: docs }, { data: versions }, { data: queries }] =
      await Promise.all([
        supabase
          .from('app_users')
          .select('id, username, full_name, email, org_unit, school_number')
          .eq('id', access.appUserId)
          .maybeSingle(),
        supabase
          .from('schools')
          .select('school_number, name, active, privacy_policy_accepted_at')
          .eq('school_number', schoolNumber)
          .maybeSingle(),
        supabase
          .from('documents')
          .select(
            'id, title, document_type_code, created_at, status, protection_class_id, reach_scope, gremium, responsible_unit, participation_groups, review_date, archived_at, school_number'
          )
          .eq('school_number', schoolNumber)
          .order('created_at', { ascending: false }),
        supabase
          .from('document_versions')
          .select('id, document_id, version_number, created_at, comment, mime_type, is_published, school_number')
          .eq('school_number', schoolNumber)
          .order('created_at', { ascending: false }),
        supabase
          .from('ai_queries')
          .select('id, created_at, question, answer_excerpt, success, used_document_ids')
          .eq('school_number', schoolNumber)
          .eq('user_id', access.appUserId)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

    const rolesRes = await supabase.from('user_roles').select('role_code').eq('user_id', access.appUserId);

    const docRows = (docs ?? []) as Array<{
      id: string;
      protection_class_id?: number | null;
      responsible_unit?: string | null;
      [key: string]: unknown;
    }>;
    const documents = docRows.filter((d) =>
      canReadDocument(access, d.protection_class_id, d.responsible_unit ?? null)
    );
    const allowedDocIds = new Set(documents.map((d) => d.id));
    const versionRows = (versions ?? []) as Array<{ document_id: string; [key: string]: unknown }>;
    const documentVersions = versionRows.filter((v) => allowedDocIds.has(v.document_id));

    const payload = {
      exportVersion: 1,
      generatedAt: new Date().toISOString(),
      account: {
        authEmail: user.email.trim().toLowerCase(),
        appUser: appRow ?? null,
        roles: (rolesRes.data ?? []).map((r) => r.role_code).filter(Boolean),
        accessSummary: {
          orgUnit: access.orgUnit,
          schoolNumber: access.schoolNumber,
        },
      },
      school: schoolRow ?? null,
      documents,
      documentVersions,
      aiQueries: queries ?? [],
    };

    const body = JSON.stringify(payload, null, 2);
    const filename = `slboard-datenexport-${schoolNumber}.json`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
