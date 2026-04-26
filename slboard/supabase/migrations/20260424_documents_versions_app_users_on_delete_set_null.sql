-- Admin: app_users löschen — Dokumente behalten Historie; Urheber/Zuständigkeit-Referenz wird NULL.
-- Behebt: violates foreign key constraint "documents_created_by_id_fkey" on table "documents"

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'created_by_id'
  ) then
    alter table public.documents drop constraint if exists documents_created_by_id_fkey;
    alter table public.documents alter column created_by_id drop not null;
    alter table public.documents
      add constraint documents_created_by_id_fkey
      foreign key (created_by_id) references public.app_users (id) on delete set null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'responsible_person_id'
  ) then
    alter table public.documents drop constraint if exists documents_responsible_person_id_fkey;
    alter table public.documents alter column responsible_person_id drop not null;
    alter table public.documents
      add constraint documents_responsible_person_id_fkey
      foreign key (responsible_person_id) references public.app_users (id) on delete set null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_versions'
      and column_name = 'created_by_id'
  ) then
    alter table public.document_versions drop constraint if exists document_versions_created_by_id_fkey;
    alter table public.document_versions alter column created_by_id drop not null;
    alter table public.document_versions
      add constraint document_versions_created_by_id_fkey
      foreign key (created_by_id) references public.app_users (id) on delete set null;
  end if;
end $$;
