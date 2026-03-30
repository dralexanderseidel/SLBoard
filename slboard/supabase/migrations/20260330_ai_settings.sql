-- Per-school KI-Konfiguration (Chunking, Logging, Limits)

create table if not exists public.ai_settings (
  school_number char(6) primary key references public.schools(school_number) on delete cascade,
  max_text_per_doc integer not null default 4500,
  chunk_chars integer not null default 2500,
  chunk_overlap_chars integer not null default 300,
  max_chunks_per_doc integer not null default 3,
  debug_log_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Default row for existing installations
insert into public.ai_settings (school_number)
values ('000000')
on conflict (school_number) do nothing;

-- RLS
alter table if exists public.ai_settings enable row level security;

drop policy if exists ai_settings_select_own_school_admin on public.ai_settings;
create policy ai_settings_select_own_school_admin
on public.ai_settings
for select
to authenticated
using (
  school_number = public.current_school_number()
  and public.current_is_admin()
);

drop policy if exists ai_settings_insert_own_school_admin on public.ai_settings;
create policy ai_settings_insert_own_school_admin
on public.ai_settings
for insert
to authenticated
with check (
  school_number = public.current_school_number()
  and public.current_is_admin()
);

drop policy if exists ai_settings_update_own_school_admin on public.ai_settings;
create policy ai_settings_update_own_school_admin
on public.ai_settings
for update
to authenticated
using (
  school_number = public.current_school_number()
  and public.current_is_admin()
)
with check (
  school_number = public.current_school_number()
  and public.current_is_admin()
);

