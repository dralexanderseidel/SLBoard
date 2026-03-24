import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabaseServer';
import { createServerSupabaseClient } from '../../../../lib/supabaseServerClient';
import { getUserAccessContext } from '../../../../lib/documentAccess';

const createdById = '00000000-0000-0000-0000-000000000001';

/**
 * Entwurf als echtes Dokument übernehmen: Dokument anlegen + Entwurfstext als erste Version (.txt).
 */
export async function POST(req: NextRequest) {
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
    const schoolNumber = access.schoolNumber ?? '000000';

    const body = await req.json();
    const subject = (body.subject as string)?.trim();
    const audience = (body.audience as string)?.trim() || 'Eltern der Klassen 5–8';
    const context = (body.context as string)?.trim() || '';
    const draftBody = (body.body as string)?.trim();

    if (!subject || !draftBody) {
      return NextResponse.json(
        { error: 'Betreff und Entwurfstext sind Pflicht.' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const legalReference = `Entwurf für: ${audience}\nKontext: ${context}\n\nText:\n${draftBody}`;

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        school_number: schoolNumber,
        title: subject,
        document_type_code: 'ELTERNBRIEF',
        created_at: today,
        created_by_id: createdById,
        responsible_person_id: createdById,
        responsible_unit: 'Schulleitung',
        protection_class_id: 2,
        status: 'ENTWURF',
        gremium: null,
        legal_reference: legalReference,
      })
      .select('id')
      .single();

    if (docError || !doc?.id) {
      return NextResponse.json(
        { error: docError?.message ?? 'Dokument konnte nicht angelegt werden.' },
        { status: 500 }
      );
    }

    const documentId = doc.id;
    const fileId = crypto.randomUUID();
    const filePath = `${schoolNumber}/${documentId}/${fileId}.txt`;
    const textContent = `Betreff: ${subject}\nZielgruppe: ${audience}\n\n${context ? `Kontext: ${context}\n\n` : ''}${draftBody}`;
    const buffer = Buffer.from(textContent, 'utf-8');

    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: 'text/plain; charset=utf-8',
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) {
      await supabase.from('documents').delete().eq('id', documentId).eq('school_number', schoolNumber);
      return NextResponse.json(
        { error: `Speicher-Fehler: ${storageError.message}` },
        { status: 500 }
      );
    }

    const { data: verData, error: verError } = await supabase
      .from('document_versions')
      .insert({
        school_number: schoolNumber,
        document_id: documentId,
        version_number: '1.0',
        created_by_id: createdById,
        comment: 'Erste Version aus Entwurf (Entwurfsassistent)',
        file_uri: filePath,
        mime_type: 'text/plain',
        is_published: false,
      })
      .select('id')
      .single();

    if (verError || !verData) {
      await supabase.storage.from('documents').remove([filePath]);
      await supabase.from('documents').delete().eq('id', documentId).eq('school_number', schoolNumber);
      return NextResponse.json(
        { error: verError?.message ?? 'Version konnte nicht angelegt werden.' },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from('documents')
      .update({ current_version_id: verData.id })
      .eq('id', documentId)
      .eq('school_number', schoolNumber);

    if (updateError) {
      return NextResponse.json(
        { error: 'Aktuelle Version konnte nicht gesetzt werden.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId: documentId,
      message: 'Entwurf wurde als Dokument mit erster Version gespeichert.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
