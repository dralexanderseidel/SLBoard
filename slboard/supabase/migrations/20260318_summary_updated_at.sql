-- Tracks when KI-Zusammenfassung zuletzt aktualisiert wurde
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS summary_updated_at timestamptz;

