import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../lib/documentAccess';

/**
 * GET /api/notifications
 * Liefert beide Dashboard-Notifications in einem einzigen Request:
 * - recentlyPublished: kürzlich veröffentlichte Dokumente
 * - reviewOverdue:     überfällige Evaluations-/Wiedervorlage-Termine
 */
export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = (await client?.auth.getUser()) ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ recentlyPublished: [], reviewOverdue: [] }, { status: 401 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ recentlyPublished: [], reviewOverdue: [] }, { status: 503 });
    }

    const access = await resolveUserAccess(user.email, supabase);

    const today = new Date();
    const ymd = today.toISOString().slice(0, 10);

    // Beide Queries parallel ausführen
    const [auditResult, overdueResult] = await Promise.all([
      (() => {
        let q = supabase
          .from('audit_log')
          .select('entity_id, created_at, new_values, old_values, school_number')
          .eq('entity_type', 'document')
          .eq('action', 'document.update')
          .not('new_values', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50);
        if (access.schoolNumber) q = q.eq('school_number', access.schoolNumber);
        return q;
      })(),
      (() => {
        let q = supabase
          .from('documents')
          .select('id, title, review_date, protection_class_id, responsible_unit, status, school_number')
          .not('review_date', 'is', null)
          .lt('review_date', ymd)
          .eq('status', 'VEROEFFENTLICHT')
          .is('archived_at', null)
          .order('review_date', { ascending: true })
          .limit(20);
        if (access.schoolNumber) q = q.eq('school_number', access.schoolNumber);
        return q;
      })(),
    ]);

    // --- Recently published ---
    let recentlyPublished: { documentId: string; title: string; publishedAt: string }[] = [];
    if (!auditResult.error && auditResult.data?.length) {
      const publishedEvents = auditResult.data.filter((e) => {
        const nv = e.new_values as { status?: string } | null;
        const ov = e.old_values as { status?: string } | null;
        return nv?.status === 'VEROEFFENTLICHT' && ov?.status !== 'VEROEFFENTLICHT';
      });

      const documentIds = [...new Set(publishedEvents.map((e) => e.entity_id as string))].slice(0, 15);
      if (documentIds.length > 0) {
        const { data: docs } = await supabase
          .from('documents')
          .select('id, title, responsible_unit, protection_class_id, school_number')
          .in('id', documentIds)
          .eq('status', 'VEROEFFENTLICHT')
          .is('archived_at', null);

        if (docs?.length) {
          const byId = new Map<string, string>();
          for (const e of publishedEvents) {
            const id = e.entity_id as string;
            if (!byId.has(id)) byId.set(id, e.created_at as string);
          }
          recentlyPublished = docs
            .filter((d) =>
              canAccessSchool(access, d.school_number as string | null) &&
              canReadDocument(access, d.protection_class_id as number, d.responsible_unit as string | null)
            )
            .map((d) => ({
              documentId: d.id,
              title: d.title,
              publishedAt: byId.get(d.id) ?? today.toISOString(),
            }))
            .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
            .slice(0, 10);
        }
      }
    }

    // --- Review overdue ---
    const reviewOverdue = (!overdueResult.error && overdueResult.data)
      ? overdueResult.data
          .filter((d) =>
            canAccessSchool(access, d.school_number as string | null) &&
            canReadDocument(access, d.protection_class_id as number, (d.responsible_unit as string | null) ?? null)
          )
          .slice(0, 10)
          .map((d) => ({
            documentId: d.id as string,
            title: d.title as string,
            reviewDate: d.review_date as string,
            responsibleUnit: (d.responsible_unit as string | null) ?? null,
          }))
      : [];

    return NextResponse.json({ recentlyPublished, reviewOverdue });
  } catch {
    return NextResponse.json({ recentlyPublished: [], reviewOverdue: [] });
  }
}
