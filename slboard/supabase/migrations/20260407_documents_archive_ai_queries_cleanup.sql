-- Archivierung: Dokumente bleiben in der DB, KI-Anfragen bleiben verlinkbar.
-- Endgültiges Löschen entfernt zugehörige ai_queries (siehe RPC).

alter table public.documents
  add column if not exists archived_at timestamptz null;

comment on column public.documents.archived_at is 'Wenn gesetzt: Dokument nur noch unter Archiv; nicht in normaler Liste / KI-Pool.';

create index if not exists idx_documents_school_archived_at
  on public.documents (school_number, archived_at);

-- Spalte für zuverlässiges Aufräumen bei endgültigem Löschen (Insert nutzt sie bereits in der App)
alter table public.ai_queries
  add column if not exists used_document_ids uuid[] null;

comment on column public.ai_queries.used_document_ids is 'UUIDs der Dokumente, die in der KI-Antwort verwendet wurden.';

create or replace function public.delete_ai_queries_referencing_document(
  p_document_id uuid,
  p_school_number text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with del as (
    delete from public.ai_queries q
    where q.school_number is not distinct from p_school_number
      and (
        (q.used_document_ids is not null and p_document_id = any(q.used_document_ids))
        or exists (
          select 1
          from jsonb_array_elements(coalesce(q.sources, '[]'::jsonb)) el
          where nullif(trim(el->>'documentId'), '') is not null
            and trim(el->>'documentId') = trim(p_document_id::text)
        )
      )
    returning 1
  )
  select count(*)::int into n from del;
  return coalesce(n, 0);
end;
$$;

comment on function public.delete_ai_queries_referencing_document(uuid, text) is
  'Wird beim endgültigen Löschen eines Dokuments aufgerufen; entfernt gespeicherte KI-Anfragen, die darauf verweisen.';

grant execute on function public.delete_ai_queries_referencing_document(uuid, text) to service_role;
