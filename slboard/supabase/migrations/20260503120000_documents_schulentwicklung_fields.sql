-- Denormalisierte Schulentwicklungs-Einordnung (aus KI-Steuerungsanalyse) für Listen/Filter/Cockpit
alter table public.documents
  add column if not exists schulentwicklung_primary_field text,
  add column if not exists schulentwicklung_fields text[];

comment on column public.documents.schulentwicklung_primary_field is
  'Primäres Aufgabenfeld Schulentwicklung (KI), z. B. organisationsentwicklung — aus steering_analysis.classification.';

comment on column public.documents.schulentwicklung_fields is
  'Alle zugeordneten Aufgabenfelder (primär + sekundär), aus steering_analysis.classification.';
