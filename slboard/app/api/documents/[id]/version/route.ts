import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../../lib/supabaseServerClient';
import { getDocumentText } from '../../../../../lib/documentText';
import { buildSearchIndex } from '../../../../../lib/indexing';

const ROLES_SEE_ALL = ['SCHULLEITUNG', 'SEKRETARIAT'];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.oasis.opendocument.text',
];
const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.oasis.opendocument.text': '.odt',
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

async function userMayEditDocument(
  authEmail: string,
  docResponsibleUnit: string,
  supabase: ReturnType<typeof supabaseServer>
): Promise<boolean> {
  try {
    if (!supabase) return false;
    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, org_unit')
      .eq('email', authEmail)
      .single();
    if (!appUser) return true;
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_code')
      .eq('user_id', appUser.id);
    const hasSeeAll = (roles ?? []).some((r) => ROLES_SEE_ALL.includes(r.role_code));
    if (hasSeeAll) return true;
    return appUser.org_unit === docResponsibleUnit;
  } catch {
    return false;
  }
}

function nextVersionNumber(existing: string[]): string {
  if (existing.length === 0) return '1.1';
  const nums = existing.map((v) => parseFloat(v.replace(/^v?(\d+(?:\.\d+)?).*/, '$1'))).filter((n) => !Number.isNaN(n));
  if (nums.length === 0) return '1.1';
  const max = Math.max(...nums);
  return (Math.round((max + 0.1) * 10) / 10).toFixed(1);
}

/**
 * Neue Dateiversion zu einem bestehenden Dokument hochladen.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: documentId } = await params;

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, responsible_unit, current_version_id')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Dokument nicht gefunden.' }, { status: 404 });
    }

    const mayEdit = await userMayEditDocument(user.email, doc.responsible_unit ?? '', supabase);
    if (!mayEdit) {
      return NextResponse.json({ error: 'Keine Berechtigung, dieses Dokument zu bearbeiten.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const comment = (formData.get('comment') as string)?.trim() || 'Neue Version';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Keine gültige Datei übergeben.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Datei zu groß. Max. ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }

    let mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      const extMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.odt': 'application/vnd.oasis.opendocument.text',
      };
      const ext = (file.name ?? '').toLowerCase().match(/\.(pdf|docx|doc|odt)$/)?.[0];
      const inferred = ext ? extMap[ext] : null;
      if (inferred) {
        mimeType = inferred;
      } else {
        return NextResponse.json({ error: 'Nur PDF und Word (.pdf, .doc, .docx, .odt) erlaubt.' }, { status: 400 });
      }
    }

    const ext = MIME_TO_EXT[mimeType] ?? '.pdf';
    const safeName = sanitizeFilename(file.name);
    if (safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
      return NextResponse.json({ error: 'Ungültiger Dateiname.' }, { status: 400 });
    }

    // Bestehende Versionsnummern holen
    const { data: existingVers } = await supabase
      .from('document_versions')
      .select('version_number')
      .eq('document_id', documentId);
    const versionNumbers = (existingVers ?? []).map((v) => v.version_number as string);
    const newVersion = nextVersionNumber(versionNumbers);

    const fileId = crypto.randomUUID();
    const filePath = `${documentId}/${fileId}${ext}`;

    const buffer = await file.arrayBuffer();
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) {
      return NextResponse.json(
        { error: `Speicher-Fehler: ${storageError.message}` },
        { status: 500 }
      );
    }

    const createdById = '00000000-0000-0000-0000-000000000001';

    const { data: verData, error: verError } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: newVersion,
        created_by_id: createdById,
        comment,
        file_uri: filePath,
        mime_type: mimeType,
        is_published: false,
      })
      .select('id, version_number, created_at')
      .single();

    if (verError || !verData) {
      await supabase.storage.from('documents').remove([filePath]);
      return NextResponse.json(
        { error: verError?.message ?? 'Version konnte nicht angelegt werden.' },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update({ current_version_id: verData.id, summary: null })
      .eq('id', documentId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Aktuelle Version konnte nicht gesetzt werden.' },
        { status: 500 }
      );
    }

    // Phase A: Index aktualisieren (neue Datei → neuer Text)
    try {
      const { data: docMeta } = await supabase
        .from('documents')
        .select('title, document_type_code, gremium, responsible_unit, legal_reference')
        .eq('id', documentId)
        .single();

      const extractedText = await getDocumentText(documentId);
      const { keywords, searchText } = buildSearchIndex({
        title: (docMeta?.title as string) ?? '',
        documentType: (docMeta?.document_type_code as string) ?? null,
        gremium: (docMeta?.gremium as string) ?? null,
        responsibleUnit: (docMeta?.responsible_unit as string) ?? null,
        summary: null,
        legalReference: (docMeta?.legal_reference as string) ?? null,
        extractedText,
      });
      await supabase
        .from('documents')
        .update({ search_text: searchText, keywords, indexed_at: new Date().toISOString() })
        .eq('id', documentId);
    } catch {
      // Best-effort
    }

    const { error: auditErr } = await supabase.from('audit_log').insert({
      user_email: user.email,
      action: 'version.upload',
      entity_type: 'document',
      entity_id: documentId,
      new_values: { version_id: verData.id, version_number: newVersion, comment },
    });
    if (auditErr) {
      // audit_log optional
    }

    return NextResponse.json({
      success: true,
      versionId: verData.id,
      versionNumber: verData.version_number,
      createdAt: verData.created_at,
      message: 'Neue Version wurde hochgeladen.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
