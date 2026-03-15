-- ===========================================
-- app_users und user_roles für Zugriffsfilter
-- Nutzer mit org_unit; Rollen SCHULLEITUNG/SEKRETARIAT sehen alle Dokumente.
-- ===========================================

-- Tabelle: App-Nutzer (E-Mail sollte mit Supabase Auth übereinstimmen)
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  full_name text not null,
  email text not null unique,
  org_unit text not null,
  created_at timestamptz default now()
);

-- Tabelle: Rollen pro Nutzer
create table if not exists public.user_roles (
  user_id uuid not null references public.app_users(id) on delete cascade,
  role_code text not null,
  primary key (user_id, role_code)
);

-- Indizes für Abfragen (Zugriffsfilter, Admin-Listen)
create index if not exists idx_app_users_email on public.app_users(email);
create index if not exists idx_user_roles_user_id on public.user_roles(user_id);
create index if not exists idx_user_roles_role_code on public.user_roles(role_code);

-- Optional: RLS aktivieren, dann Policies für app_users/user_roles setzen.
-- Wenn nur die App (Service Role) schreibt, reicht es, die Tabellen ohne RLS zu lassen.
-- alter table public.app_users enable row level security;
-- alter table public.user_roles enable row level security;

comment on table public.app_users is 'App-Nutzer; org_unit bestimmt Sichtbarkeit der Dokumentenliste (mit user_roles).';
comment on table public.user_roles is 'Rollen pro Nutzer; SCHULLEITUNG/SEKRETARIAT sehen alle Dokumente.';
