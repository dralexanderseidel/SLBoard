-- Erweitert legal_reference von varchar(500) auf TEXT,
-- damit längere Entwurfstexte (z. B. aus dem Entwurfsassistenten) gespeichert werden können.
ALTER TABLE public.documents
  ALTER COLUMN legal_reference TYPE text;
