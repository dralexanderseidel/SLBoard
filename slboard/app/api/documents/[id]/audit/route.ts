import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../../../lib/documentAccess';
import { apiError } from '../../../../../lib/apiError';

/**
 * GET: Audit-Log für ein Dokument (wer hat was wann geändert).
 */
export async function GET(
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

    const { id: documentId } = await params;
    const access = await resolveUserAccess(user.email, supabase);

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, responsible_unit, protection_class_id, school_number')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return apiError(404, 'NOT_FOUND', 'Dokument nicht gefunden.');
    }

    const docSchool = (doc as { school_number?: string | null }).school_number ?? null;
    const mayAccessSchool = canAccessSchool(access, docSchool);
    const mayAccess = canReadDocument(
      access,
      (doc as { protection_class_id?: number | null }).protection_class_id,
      doc.responsible_unit ?? null
    );
    if (!mayAccessSchool || !mayAccess) {
      return apiError(403, 'FORBIDDEN', 'Keine Berechtigung für dieses Dokument.');
    }

    let logQuery = supabase
      .from('audit_log')
      .select('id, user_email, action, old_values, new_values, created_at')
      .eq('entity_type', 'document')
      .eq('entity_id', documentId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (docSchool) logQuery = logQuery.eq('school_number', docSchool);
    const { data: logs, error: logError } = await logQuery;

    if (logError) {
      // Tabelle audit_log optional (Migration ggf. noch nicht ausgeführt)
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: logs ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}
