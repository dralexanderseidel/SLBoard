-- Tarif-/Quota-Felder pro Schule (NULL = unbegrenzt)
alter table if exists public.schools
  add column if not exists quota_max_users integer,
  add column if not exists quota_max_documents integer,
  add column if not exists quota_max_ai_queries_per_month integer;

comment on column public.schools.quota_max_users is 'Obergrenze Nutzer; NULL = unbegrenzt.';
comment on column public.schools.quota_max_documents is 'Obergrenze Dokumente; NULL = unbegrenzt.';
comment on column public.schools.quota_max_ai_queries_per_month is 'Obergrenze KI-Anfragen pro Kalendermonat (UTC); NULL = unbegrenzt.';

-- Aggregierte Nutzung für Super-Admin-Dashboard (ein Aufruf, nur service_role)
create or replace function public.school_usage_stats()
returns table (
  school_number char(6),
  user_count bigint,
  document_count bigint,
  ai_queries_total bigint,
  ai_queries_month bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.school_number,
    coalesce(
      (select count(*)::bigint from public.app_users u where u.school_number = s.school_number),
      0
    ) as user_count,
    coalesce(
      (select count(*)::bigint from public.documents d where d.school_number = s.school_number),
      0
    ) as document_count,
    coalesce(
      (select count(*)::bigint from public.ai_queries q where q.school_number = s.school_number),
      0
    ) as ai_queries_total,
    coalesce(
      (
        select count(*)::bigint
        from public.ai_queries q
        where q.school_number = s.school_number
          and q.created_at >= date_trunc('month', now())
      ),
      0
    ) as ai_queries_month
  from public.schools s;
$$;

revoke all on function public.school_usage_stats() from public;
grant execute on function public.school_usage_stats() to service_role;
