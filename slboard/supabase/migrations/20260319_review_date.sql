-- KI/Workflow-agnostische Review-Frist für Dokumente
-- Wenn review_date gesetzt ist und überschritten wird, erscheint ein Hinweis auf der Startseite.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS review_date date;

CREATE INDEX IF NOT EXISTS documents_review_date_idx
  ON public.documents (review_date);

