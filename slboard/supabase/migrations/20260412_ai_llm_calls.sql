-- Physische LLM-HTTP-Antworten pro Schule (Zählung, getrennt von ai_queries / Dashboard-Verlauf)

create table if not exists public.ai_llm_calls (
  id uuid primary key default gen_random_uuid(),
  school_number char(6) not null references public.schools (school_number) on delete restrict,
  use_case text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint ai_llm_calls_use_case_chk check (
    use_case in (
      'qa',
      'summary',
      'summarize_batch',
      'steering',
      'parent_letter',
      'prompt_preview'
    )
  )
);

comment on table public.ai_llm_calls is
  'Eine Zeile pro erfolgreicher LLM-HTTP-Antwort (physischer Aufruf), mandantenbezogen.';

create index if not exists idx_ai_llm_calls_school_created_at
  on public.ai_llm_calls (school_number, created_at desc);

-- Erweiterte Nutzungsstatistik für Super-Admin (Rückgabetyp ändert sich)
drop function if exists public.school_usage_stats();

create function public.school_usage_stats()
returns table (
  school_number char(6),
  user_count bigint,
  document_count bigint,
  ai_queries_total bigint,
  ai_queries_month bigint,
  llm_calls_total bigint,
  llm_calls_month bigint
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
    ) as ai_queries_month,
    coalesce(
      (select count(*)::bigint from public.ai_llm_calls c where c.school_number = s.school_number),
      0
    ) as llm_calls_total,
    coalesce(
      (
        select count(*)::bigint
        from public.ai_llm_calls c
        where c.school_number = s.school_number
          and c.created_at >= date_trunc('month', now())
      ),
      0
    ) as llm_calls_month
  from public.schools s;
$$;

revoke all on function public.school_usage_stats() from public;
grant execute on function public.school_usage_stats() to service_role;

-- RLS: wie ai_queries (nur lesen/einfügen für eigene Schule über Session)
alter table public.ai_llm_calls enable row level security;

drop policy if exists ai_llm_calls_select_own_school on public.ai_llm_calls;
create policy ai_llm_calls_select_own_school
on public.ai_llm_calls
for select
to authenticated
using (school_number = public.current_school_number());

drop policy if exists ai_llm_calls_insert_own_school on public.ai_llm_calls;
create policy ai_llm_calls_insert_own_school
on public.ai_llm_calls
for insert
to authenticated
with check (school_number = public.current_school_number());

grant select, insert on public.ai_llm_calls to authenticated;
grant all on public.ai_llm_calls to service_role;
