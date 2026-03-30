-- Schul-Steckbrief für KI-Kontext (pro Schule)

alter table if exists public.schools
  add column if not exists profile_text text;

