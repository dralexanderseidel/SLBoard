-- Kommentare zu Dokumenten (Soft-Delete); Zugriff nur über Service-Role-API mit canReadDocument

create table if not exists public.document_comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  school_number char(6) not null references public.schools (school_number) on delete cascade,
  author_app_user_id uuid references public.app_users (id) on delete set null,
  author_email text not null,
  author_label text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint document_comments_body_nonempty check (char_length(trim(body)) > 0)
);

create index if not exists idx_document_comments_document_active
  on public.document_comments (document_id, created_at)
  where deleted_at is null;

create index if not exists idx_document_comments_school_document
  on public.document_comments (school_number, document_id);

comment on table public.document_comments is
  'Nutzerkommentare zu Dokumenten; Löschen nur soft (deleted_at). Lesen/Schreiben nur über API (Berechtigung = Dokument lesen).';

alter table public.document_comments enable row level security;

revoke all on public.document_comments from public;
revoke all on public.document_comments from anon;
revoke all on public.document_comments from authenticated;

grant select, insert, update, delete on public.document_comments to service_role;
