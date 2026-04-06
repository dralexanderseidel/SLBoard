import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';

type ReviewOverdueItem = {
  documentId: string;
  title: string;
  reviewDate: string; // ISO date
  responsibleUnit: string | null;
};

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

    const today = new Date();
    const ymd = today.toISOString().slice(0, 10); // YYYY-MM-DD

    // Review ist overdue, wenn review_date gesetzt und < heute.
    // Optional Einschränkung auf VEROEFFENTLICHT: sinnvoll für organisatorische Reviews.
    let docsQuery = supabase
      .from('documents')
      .select('id, title, review_date, protection_class_id, responsible_unit, status, school_number')
      .not('review_date', 'is', null)
      .lt('review_date', ymd)
      .eq('status', 'VEROEFFENTLICHT')
      .is('archived_at', null)
      .order('review_date', { ascending: true })
      .limit(20);
    if (access.schoolNumber) docsQuery = docsQuery.eq('school_number', access.schoolNumber);
    const { data: docs, error } = await docsQuery;

    if (error) {
      return NextResponse.json({ data: [] });
    }

    const filtered = (docs ?? []).filter((d) =>
      canAccessSchool(access, d.school_number as string | null) &&
      canReadDocument(
        access,
        d.protection_class_id as number,
        (d.responsible_unit as string | null) ?? null,
      )
    );

    const result: ReviewOverdueItem[] = filtered.map((d) => ({
      documentId: d.id as string,
      title: d.title as string,
      reviewDate: d.review_date as string,
      responsibleUnit: (d.responsible_unit as string | null) ?? null,
    }));

    return NextResponse.json({
      data: result.slice(0, 10),
    });
  } catch {
    return NextResponse.json({ data: [] });
  }
}

