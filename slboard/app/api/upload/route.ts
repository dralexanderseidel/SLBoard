import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../lib/supabaseServerClient';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.oasis.opendocument.text', // .odt
];
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.odt'];

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'application/vnd.oasis.opendocument.text': '.odt',
  };
  return map[mimeType] ?? '.pdf';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

export async function POST(req: NextRequest) {
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json(
        { error: 'Anmeldung erforderlich. Bitte melden Sie sich an.' },
        { status: 401 }
      );
    }

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase-Service ist nicht konfiguriert (SUPABASE_SERVICE_ROLE_KEY fehlt).' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string)?.trim();
    const type = (formData.get('type') as string)?.trim() || 'ELTERNBRIEF';
    const date = (formData.get('date') as string)?.trim();
    const status = (formData.get('status') as string)?.trim() || 'ENTWURF';
    const protectionClass = (formData.get('protectionClass') as string)?.trim() || '1';
    const gremium = (formData.get('gremium') as string)?.trim() || null;
    const responsibleUnit = (formData.get('responsibleUnit') as string)?.trim() || 'Schulleitung';

    // Validierung
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Keine gültige Datei übergeben.' }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: 'Titel ist Pflichtfeld.' }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: 'Datum ist Pflichtfeld.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Datei ist zu groß. Maximale Größe: ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }

    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'Nur PDF- und Word-Dateien (.pdf, .doc, .docx, .odt) sind erlaubt.' },
        { status: 400 }
      );
    }

    const ext = getExtension(mimeType);
    const safeName = sanitizeFilename(file.name);

    // Pfad-Traversal verhindern
    if (safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
      return NextResponse.json({ error: 'Ungültiger Dateiname.' }, { status: 400 });
    }

    const protectionId = Math.max(1, Math.min(2, parseInt(protectionClass, 10) || 1));
    const createdById = '00000000-0000-0000-0000-000000000001'; // Platzhalter; später aus Session

    // 1) Dokument anlegen
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        title,
        document_type_code: type,
        created_at: date,
        created_by_id: createdById,
        responsible_person_id: createdById,
        responsible_unit: responsibleUnit,
        protection_class_id: protectionId,
        status,
        gremium,
      })
      .select('id')
      .single();

    if (docError || !docData) {
      return NextResponse.json(
        { error: docError?.message ?? 'Dokument konnte nicht angelegt werden.' },
        { status: 500 }
      );
    }

    const documentId = docData.id as string;
    const fileId = crypto.randomUUID();
    const filePath = `${documentId}/${fileId}${ext}`;

    // 2) Datei in Storage hochladen
    const buffer = await file.arrayBuffer();
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) {
      await supabase.from('documents').delete().eq('id', documentId);
      return NextResponse.json(
        { error: `Speicher-Fehler: ${storageError.message}` },
        { status: 500 }
      );
    }

    // 3) Version mit file_uri anlegen
    const { data: verData, error: verError } = await supabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: '1.0',
        created_by_id: createdById,
        comment: 'Erstfassung',
        file_uri: filePath,
        mime_type: mimeType,
        is_published: status === 'FREIGEGEBEN',
      })
      .select('id')
      .single();

    if (verError || !verData) {
      await supabase.storage.from('documents').remove([filePath]);
      await supabase.from('documents').delete().eq('id', documentId);
      return NextResponse.json(
        { error: verError?.message ?? 'Dokumentversion konnte nicht angelegt werden.' },
        { status: 500 }
      );
    }

    const versionId = verData.id as string;

    // 4) current_version_id im Dokument setzen
    const { error: updateDocError } = await supabase
      .from('documents')
      .update({ current_version_id: versionId })
      .eq('id', documentId);

    if (updateDocError) {
      return NextResponse.json(
        { error: updateDocError.message ?? 'current_version_id konnte nicht gesetzt werden.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId,
      versionId,
      message: 'Dokument wurde erfolgreich hochgeladen.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler beim Upload.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
