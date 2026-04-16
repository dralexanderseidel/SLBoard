-- Entwurfs-Konfiguration pro Dokumenttyp
-- Erlaubt schulspezifische Anpassung von Zielgruppe, Schreibstil und Formatanweisung
-- die der Entwurfsassistent für den KI-Prompt nutzt.

ALTER TABLE public.school_document_type_options
  ADD COLUMN IF NOT EXISTS draft_audience    text,
  ADD COLUMN IF NOT EXISTS draft_tone        text,
  ADD COLUMN IF NOT EXISTS draft_format_hint text;

-- Defaults für alle bekannten Typen in bestehenden Schulen setzen (idempotent)
UPDATE public.school_document_type_options SET
  draft_audience = CASE code
    WHEN 'ELTERNBRIEF'        THEN 'Eltern der Schulgemeinschaft'
    WHEN 'RUNDSCHREIBEN'      THEN 'Kollegium'
    WHEN 'KONZEPT'            THEN 'Schulleitung und Kollegium'
    WHEN 'PROTOKOLL'          THEN 'Teilnehmende des Gremiums'
    WHEN 'BESCHLUSSVORLAGE'   THEN 'Schulkonferenz'
    WHEN 'CURRICULUM'         THEN 'Fachkonferenz'
    WHEN 'VEREINBARUNG'       THEN 'Beteiligte Parteien'
    WHEN 'SITUATIVE_REGELUNG' THEN 'Schulgemeinschaft'
    ELSE NULL
  END,
  draft_tone = CASE code
    WHEN 'ELTERNBRIEF'        THEN 'sachlichem, freundlichem'
    WHEN 'RUNDSCHREIBEN'      THEN 'klarem, informierendem'
    WHEN 'KONZEPT'            THEN 'strukturiertem, sachlichem'
    WHEN 'PROTOKOLL'          THEN 'sachlichem, neutralem'
    WHEN 'BESCHLUSSVORLAGE'   THEN 'sachlichem, verbindlichem'
    WHEN 'CURRICULUM'         THEN 'präzisem, fachlichem'
    WHEN 'VEREINBARUNG'       THEN 'verbindlichem, klarem'
    WHEN 'SITUATIVE_REGELUNG' THEN 'klarem, direktem'
    ELSE NULL
  END,
  draft_format_hint = CASE code
    WHEN 'ELTERNBRIEF'        THEN 'Mit Anrede und Grußformel.'
    WHEN 'RUNDSCHREIBEN'      THEN 'Gliedere in: Betreff, Anlass, wichtigste Informationen, ggf. Handlungsaufforderung, Absender.'
    WHEN 'KONZEPT'            THEN 'Gliedere in: 1. Ausgangslage · 2. Ziele · 3. Maßnahmen · 4. Evaluation · 5. Verantwortlichkeiten. Verwende Überschriften.'
    WHEN 'PROTOKOLL'          THEN 'Protokollformat: Datum, Teilnehmende, Tagesordnungspunkte (TOP 1, TOP 2, …), Beschlüsse, Nächste Schritte.'
    WHEN 'BESCHLUSSVORLAGE'   THEN 'Struktur: Betreff, Sachverhalt/Begründung, Beschlussvorschlag, Abstimmungsverfahren.'
    WHEN 'CURRICULUM'         THEN 'Struktur: Fach/Jahrgang, Kompetenzen/Lernziele, Inhalte, Methoden, Leistungsbewertung, Materialien.'
    WHEN 'VEREINBARUNG'       THEN 'Struktur: Parteien, Gegenstand, Regelungen (nummeriert), Gültigkeit, Unterschriften.'
    WHEN 'SITUATIVE_REGELUNG' THEN 'Kompakt und klar: Anlass, Regelung, Geltungsbereich, Inkrafttreten.'
    ELSE NULL
  END
WHERE draft_audience IS NULL
  AND code IN (
    'ELTERNBRIEF','RUNDSCHREIBEN','KONZEPT','PROTOKOLL',
    'BESCHLUSSVORLAGE','CURRICULUM','VEREINBARUNG','SITUATIVE_REGELUNG'
  );
