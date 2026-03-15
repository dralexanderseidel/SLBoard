-- ===========================================
-- Schritt 5: Storage-Policies – Zugriff nach responsible_unit
-- Ersetzt die permissive SELECT-Policy durch eine restriktivere.
-- Nur Nutzer mit passender Rolle (SCHULLEITUNG/SEKRETARIAT) oder
-- matching responsible_unit dürfen Dateien lesen.
-- ===========================================

-- Alte Policy entfernen
drop policy if exists "documents_authenticated_select" on storage.objects;

-- Neue Policy: SELECT nur wenn Nutzer berechtigt ist
-- Pfadformat: {documentId}/{fileId}.ext
create policy "documents_select_by_unit"
on storage.objects for select
to authenticated
using (
  bucket_id = 'documents'
  and (string_to_array(name, '/'))[1] is not null
  and exists (
    select 1 from public.documents d
    join public.app_users u on u.email = (auth.jwt()->>'email')
    left join public.user_roles ur on ur.user_id = u.id and ur.role_code in ('SCHULLEITUNG', 'SEKRETARIAT')
    where d.id::text = (string_to_array(name, '/'))[1]
    and (
      ur.role_code is not null
      or d.responsible_unit = u.org_unit
    )
  )
);
