-- DSGVO: Einwilligung bei Selbstregistrierung; schlanke Löschanfragen (nur Protokollierung)

alter table if exists public.schools
  add column if not exists privacy_policy_accepted_at timestamptz;

comment on column public.schools.privacy_policy_accepted_at is
  'Zeitpunkt der Bestätigung der Datenschutzhinweise bei Schul-Selbstregistrierung (onboarding/register-school).';

create table if not exists public.account_delete_requests (
  id uuid primary key default gen_random_uuid(),
  school_number char(6) not null references public.schools (school_number) on delete cascade,
  app_user_id uuid not null references public.app_users (id) on delete cascade,
  email text not null,
  requested_at timestamptz not null default now()
);

comment on table public.account_delete_requests is
  'Vom Nutzer beantragte Kontolöschung (technische Basis); Bearbeitung durch Administrator. Kein automatisches Löschen.';

create index if not exists idx_account_delete_requests_school_requested
  on public.account_delete_requests (school_number, requested_at desc);

alter table public.account_delete_requests enable row level security;

revoke all on public.account_delete_requests from public;
revoke all on public.account_delete_requests from anon;
revoke all on public.account_delete_requests from authenticated;

grant select, insert, delete on public.account_delete_requests to service_role;
