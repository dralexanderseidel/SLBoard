-- Phase A: Suchindex-Felder für programmatische Verschlagwortung / Suche
-- search_text: aggregierter Text (Titel + Metadaten + Keywords + Ausschnitt)
-- keywords: Schlagwörter (ohne KI)
-- indexed_at: Zeitpunkt der letzten Indexierung

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS search_text text,
  ADD COLUMN IF NOT EXISTS keywords text[],
  ADD COLUMN IF NOT EXISTS indexed_at timestamptz;

