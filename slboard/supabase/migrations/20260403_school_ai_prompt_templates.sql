-- Editierbare KI-Prompt-Bausteine pro Schule und Use Case

create table if not exists public.school_ai_prompt_templates (
  school_number char(6) not null references public.schools(school_number) on delete cascade,
  use_case text not null check (use_case in ('qa', 'summary', 'steering')),
  system_editable text not null default '',
  user_editable text not null default '',
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (school_number, use_case)
);

alter table if exists public.school_ai_prompt_templates enable row level security;

drop policy if exists school_ai_prompt_templates_select_own_school_admin on public.school_ai_prompt_templates;
create policy school_ai_prompt_templates_select_own_school_admin
on public.school_ai_prompt_templates
for select
to authenticated
using (
  school_number = public.current_school_number()
  and public.current_is_admin()
);

drop policy if exists school_ai_prompt_templates_insert_own_school_admin on public.school_ai_prompt_templates;
create policy school_ai_prompt_templates_insert_own_school_admin
on public.school_ai_prompt_templates
for insert
to authenticated
with check (
  school_number = public.current_school_number()
  and public.current_is_admin()
);

drop policy if exists school_ai_prompt_templates_update_own_school_admin on public.school_ai_prompt_templates;
create policy school_ai_prompt_templates_update_own_school_admin
on public.school_ai_prompt_templates
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
