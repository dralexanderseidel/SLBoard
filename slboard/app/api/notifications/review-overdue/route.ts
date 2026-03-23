import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { canReadDocument, getUserAccessContext } from '../../../../lib/documentAccess';

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
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    }

    const access = await getUserAccessContext(user.email, supabase);

    const today = new Date();
    const ymd = today.toISOString().slice(0, 10); // YYYY-MM-DD

    // Review ist overdue, wenn review_date gesetzt und < heute.
    // Optional Einschränkung auf VEROEFFENTLICHT: sinnvoll für organisatorische Reviews.
    const { data: docs, error } = await supabase
      .from('documents')
      .select('id, title, review_date, protection_class_id, responsible_unit, status')
      .not('review_date', 'is', null)
      .lt('review_date', ymd)
      .eq('status', 'VEROEFFENTLICHT')
      .order('review_date', { ascending: true })
      .limit(20);

    if (error) {
      return NextResponse.json({ data: [] });
    }

    const filtered = (docs ?? []).filter((d) =>
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

