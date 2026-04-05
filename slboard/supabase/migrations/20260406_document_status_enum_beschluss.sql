-- Workflow: documents.status nutzt Enum document_status — Wert BESCHLUSS ergänzen
-- Ohne Migration: invalid input value for enum document_status: "BESCHLUSS"

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'document_status'
      and n.nspname = 'public'
  ) and not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'document_status'
      and n.nspname = 'public'
      and e.enumlabel = 'BESCHLUSS'
  ) then
    execute 'alter type public.document_status add value ''BESCHLUSS''';
  end if;
end
$$;
