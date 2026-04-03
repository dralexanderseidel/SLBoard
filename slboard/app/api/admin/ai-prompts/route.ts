import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { isAdmin } from '../../../../lib/adminAuth';
import { getUserAccessContext } from '../../../../lib/documentAccess';
import {
  getAllSchoolPromptTemplates,
  resetSchoolPromptTemplate,
  saveSchoolPromptTemplate,
  type PromptUseCase,
} from '../../../../lib/aiPromptTemplates';
import { apiError } from '../../../../lib/apiError';

export const runtime = 'nodejs';

type UpdateRow = {
  use_case: PromptUseCase;
  system_editable?: string;
  user_editable?: string;
};

type UpdatePayload = {
  templates?: UpdateRow[];
};

type ResetPayload = {
  use_case?: PromptUseCase;
};

export async function GET() {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');

    const supabase = supabaseServer();
    if (!supabase) return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfuegbar.');
    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const access = await getUserAccessContext(user.email, supabase);
    const schoolNumber = access.schoolNumber ?? '000000';
    const templates = await getAllSchoolPromptTemplates(schoolNumber);
    return NextResponse.json({ templates, schoolNumber });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');

    const supabase = supabaseServer();
    if (!supabase) return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfuegbar.');
    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const body = (await req.json().catch(() => ({}))) as UpdatePayload;
    const updates = Array.isArray(body.templates) ? body.templates : [];
    if (updates.length === 0) {
      return apiError(400, 'VALIDATION_ERROR', 'Keine Template-Aenderungen uebergeben.');
    }

    const access = await getUserAccessContext(user.email, supabase);
    const schoolNumber = access.schoolNumber ?? '000000';
    const allowed: PromptUseCase[] = ['qa', 'summary', 'steering'];
    for (const row of updates) {
      if (!allowed.includes(row.use_case)) continue;
      await saveSchoolPromptTemplate(schoolNumber, row.use_case, {
        system_editable: typeof row.system_editable === 'string' ? row.system_editable : undefined,
        user_editable: typeof row.user_editable === 'string' ? row.user_editable : undefined,
      });
    }

    const templates = await getAllSchoolPromptTemplates(schoolNumber);
    return NextResponse.json({ templates, schoolNumber });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) return apiError(401, 'AUTH_REQUIRED', 'Anmeldung erforderlich.');

    const supabase = supabaseServer();
    if (!supabase) return apiError(500, 'SERVICE_UNAVAILABLE', 'Service nicht verfuegbar.');
    if (!(await isAdmin(user.email, supabase))) {
      return apiError(403, 'FORBIDDEN', 'Keine Admin-Berechtigung.');
    }

    const body = (await req.json().catch(() => ({}))) as ResetPayload;
    const useCase = body.use_case;
    const allowed: PromptUseCase[] = ['qa', 'summary', 'steering'];
    if (!useCase || !allowed.includes(useCase)) {
      return apiError(400, 'VALIDATION_ERROR', 'Ungueltiger use_case.');
    }

    const access = await getUserAccessContext(user.email, supabase);
    const schoolNumber = access.schoolNumber ?? '000000';
    await resetSchoolPromptTemplate(schoolNumber, useCase);
    const templates = await getAllSchoolPromptTemplates(schoolNumber);
    return NextResponse.json({ templates, schoolNumber, reset_use_case: useCase });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return apiError(500, 'INTERNAL_ERROR', msg);
  }
}
