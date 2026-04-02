-- Dokument-Metadatum: Reichweite (intern|extern)
alter table public.documents
add column if not exists reach_scope text not null default 'intern';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_reach_scope_check'
  ) then
    alter table public.documents
      add constraint documents_reach_scope_check
      check (reach_scope in ('intern', 'extern'));
  end if;
end $$;
