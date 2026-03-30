-- ===========================================
-- Schritt 1: Supabase Storage – Bucket + Policies
-- In Supabase SQL-Editor ausführen
-- ===========================================

-- Bucket "documents" anlegen (falls noch nicht vorhanden)
-- private = true: keine öffentlichen Leselinks, nur über Auth/signed URLs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.oasis.opendocument.text', 'text/plain']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.oasis.opendocument.text', 'text/plain'];

-- Policies: Nur authentifizierte Nutzer dürfen hochladen und lesen
-- (Upload aus der API verwendet Service-Role, umgeht RLS)
-- Für restriktivere SELECT-Policy (responsible_unit) siehe:
-- supabase/migrations/20250309_storage_policies_responsible_unit.sql

-- INSERT: Authentifizierte Nutzer dürfen in den Bucket hochladen
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'documents_authenticated_insert'
  ) then
    create policy "documents_authenticated_insert"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'documents');
  end if;
end $$;

-- SELECT: Authentifizierte Nutzer dürfen Dateien lesen (für Vorschau/Download via signed URLs)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'documents_authenticated_select'
  ) then
    create policy "documents_authenticated_select"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'documents');
  end if;
end $$;
