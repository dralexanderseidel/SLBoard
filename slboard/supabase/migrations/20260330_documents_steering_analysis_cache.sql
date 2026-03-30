-- Cache für "Analyse des Steuerungsbedarfs" pro Dokument

alter table if exists public.documents
  add column if not exists steering_analysis jsonb,
  add column if not exists steering_analysis_updated_at timestamptz,
  add column if not exists steering_analysis_version_id uuid;

