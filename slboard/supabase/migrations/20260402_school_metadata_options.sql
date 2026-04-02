-- Per-school Pflege von Metadaten-Optionen (Dokumenttypen, Verantwortlich)

create table if not exists public.school_document_type_options (
  school_number char(6) not null references public.schools(school_number) on delete cascade,
  code text not null,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (school_number, code)
);

create table if not exists public.school_responsible_unit_options (
  school_number char(6) not null references public.schools(school_number) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (school_number, name)
);

-- Seed defaults for all existing schools (idempotent)
do $$
begin
  insert into public.school_document_type_options (school_number, code, label, sort_order, active)
  select s.school_number, v.code, v.label, v.sort_order, true
  from public.schools s
  cross join (
    values
      ('PROTOKOLL', 'Protokoll', 10),
      ('BESCHLUSS', 'Beschluss', 20),
      ('KONZEPT', 'Konzept', 30),
      ('CURRICULUM', 'Curriculum', 40),
      ('VEREINBARUNG', 'Vereinbarung', 50),
      ('ELTERNBRIEF', 'Elternbrief', 60),
      ('RUNDSCHREIBEN', 'Rundschreiben', 70),
      ('SITUATIVE_REGELUNG', 'Situative Regelung', 80)
  ) as v(code, label, sort_order)
  on conflict (school_number, code) do nothing;

  insert into public.school_responsible_unit_options (school_number, name, sort_order, active)
  select s.school_number, v.name, v.sort_order, true
  from public.schools s
  cross join (
    values
      ('Schulleitung', 10),
      ('Sekretariat', 20),
      ('Fachschaft Deutsch', 30),
      ('Fachschaft Mathematik', 40),
      ('Fachschaft Englisch', 50),
      ('Steuergruppe', 60),
      ('Lehrkräfte', 70)
  ) as v(name, sort_order)
  on conflict (school_number, name) do nothing;
end $$;

-- RLS
alter table if exists public.school_document_type_options enable row level security;
alter table if exists public.school_responsible_unit_options enable row level security;

drop policy if exists school_doc_types_select_own_school on public.school_document_type_options;
create policy school_doc_types_select_own_school
on public.school_document_type_options
for select
to authenticated
using (school_number = public.current_school_number());

drop policy if exists school_doc_types_modify_own_school_admin on public.school_document_type_options;
create policy school_doc_types_modify_own_school_admin
on public.school_document_type_options
for all
to authenticated
using (school_number = public.current_school_number() and public.current_is_admin())
with check (school_number = public.current_school_number() and public.current_is_admin());

drop policy if exists school_resp_units_select_own_school on public.school_responsible_unit_options;
create policy school_resp_units_select_own_school
on public.school_responsible_unit_options
for select
to authenticated
using (school_number = public.current_school_number());

drop policy if exists school_resp_units_modify_own_school_admin on public.school_responsible_unit_options;
create policy school_resp_units_modify_own_school_admin
on public.school_responsible_unit_options
for all
to authenticated
using (school_number = public.current_school_number() and public.current_is_admin())
with check (school_number = public.current_school_number() and public.current_is_admin());
