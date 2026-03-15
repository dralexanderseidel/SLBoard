-- Speichert KI-Zusammenfassungen für die Suche und bevorzugte Nutzung bei KI-Anfragen
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS summary text;
