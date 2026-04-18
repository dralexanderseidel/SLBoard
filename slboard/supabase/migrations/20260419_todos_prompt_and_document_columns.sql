-- Use Case "todos": ToDos/Aufgaben aus Dokument extrahieren (Admin-Prompts analog zu steering)
-- Cache pro Dokumentversion wie bei Steuerungsanalyse

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'school_ai_prompt_templates'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%use_case%'
  LOOP
    EXECUTE format('ALTER TABLE public.school_ai_prompt_templates DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.school_ai_prompt_templates
  ADD CONSTRAINT school_ai_prompt_templates_use_case_check
  CHECK (use_case IN ('qa', 'summary', 'steering', 'todos'));

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS steering_todos jsonb,
  ADD COLUMN IF NOT EXISTS steering_todos_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS steering_todos_version_id uuid;

COMMENT ON COLUMN public.documents.steering_todos IS
  'KI-extrahierte Aufgaben/ToDos aus dem Dokument (JSON, Schema siehe Prompt use_case todos).';
