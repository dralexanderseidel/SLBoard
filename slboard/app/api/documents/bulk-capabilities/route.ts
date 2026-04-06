import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { canAccessSchool, canReadDocument, resolveUserAccess } from '../../../../lib/documentAccess';
import { apiError } from '../../../../lib/apiError';

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
      return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfügbar.');
    }

    const { ids }: BulkCapabilitiesPayload = await req.json();
    const safeIds = (ids ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (safeIds.length === 0) {
      return NextResponse.json({ editableIds: [], blockedIds: [] });
    }

    const access = await resolveUserAccess(user.email, supabase);

    const { data: docs, error } = await supabase
      .from('documents')
      .select('id, responsible_unit, protection_class_id, school_number')
      .in('id', safeIds);

    if (error) {
      return apiError(500, 'INTERNAL_ERROR', error.message);
    }

    const editableIds: string[] = [];
    const blockedIds: string[] = [];

    for (const d of docs ?? []) {
      const inSchool = canAccessSchool(access, d.school_number as string | null);
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
      const editable = inSchool && readable && mayEditByOrg;
      if (editable) editableIds.push(d.id as string);
      else blockedIds.push(d.id as string);
    }

    return NextResponse.json({ editableIds, blockedIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', message);
  }
}

