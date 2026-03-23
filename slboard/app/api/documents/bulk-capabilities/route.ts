import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { canReadDocument, getUserAccessContext } from '../../../../lib/documentAccess';

type BulkCapabilitiesPayload = {
  ids?: string[];
};

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const {
      data: { user },
    } = (await client?.auth.getUser()) ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 });
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: 'Service nicht verfügbar.' }, { status: 500 });
    }

    const { ids }: BulkCapabilitiesPayload = await req.json();
    const safeIds = (ids ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (safeIds.length === 0) {
      return NextResponse.json({ editableIds: [], blockedIds: [] });
    }

    const access = await getUserAccessContext(user.email, supabase);

    const { data: docs, error } = await supabase
      .from('documents')
      .select('id, responsible_unit, protection_class_id')
      .in('id', safeIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const editableIds: string[] = [];
    const blockedIds: string[] = [];

    for (const d of docs ?? []) {
      const readable = canReadDocument(
        access,
        d.protection_class_id as number,
        (d.responsible_unit as string | null) ?? null
      );
      const mayEditByOrg =
        !access.hasAppUser ||
        access.isSchulleitung ||
        access.isSekretariat ||
        (!!access.orgUnit && access.orgUnit === ((d.responsible_unit as string | null) ?? null));
      const editable = readable && mayEditByOrg;
      if (editable) editableIds.push(d.id as string);
      else blockedIds.push(d.id as string);
    }

    return NextResponse.json({ editableIds, blockedIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

