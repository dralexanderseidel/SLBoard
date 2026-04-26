-- Pro Schule: KI, Entwurfsassistent, Upload-Limit (Super-Admin)

alter table public.schools
  add column if not exists feature_ai_enabled boolean not null default true;

alter table public.schools
  add column if not exists feature_drafts_enabled boolean not null default true;

alter table public.schools
  add column if not exists max_upload_file_mb integer;

comment on column public.schools.feature_ai_enabled is
  'false: keine KI-Endpunkte für diese Schule (Dashboard, Dokumente, Entwürfe, Stapel, Admin-Prompt-LLM-Test).';

comment on column public.schools.feature_drafts_enabled is
  'false: Entwurfsassistent (Navigation + APIs) deaktiviert.';

comment on column public.schools.max_upload_file_mb is
  'Max. Upload-Dateigröße in MB pro Datei; NULL = Plattform-Default (20 MB). Hard-Cap 100.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'schools_max_upload_file_mb_chk'
  ) then
    alter table public.schools
      add constraint schools_max_upload_file_mb_chk
      check (max_upload_file_mb is null or (max_upload_file_mb >= 1 and max_upload_file_mb <= 100));
  end if;
end $$;
