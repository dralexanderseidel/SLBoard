-- Admin: app_users löschen — KI-Verlauf (ai_queries) bleibt, Nutzerbezug wird NULL.
-- Behebt: violates foreign key constraint "ai_queries_user_id_fkey" on table "ai_queries"

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_queries'
      and column_name = 'user_id'
  ) then
    alter table public.ai_queries drop constraint if exists ai_queries_user_id_fkey;
    alter table public.ai_queries alter column user_id drop not null;
    alter table public.ai_queries
      add constraint ai_queries_user_id_fkey
      foreign key (user_id) references public.app_users (id) on delete set null;
  end if;
end $$;
