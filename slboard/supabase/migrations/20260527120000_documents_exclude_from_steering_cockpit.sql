-- Dokumente können bewusst aus der Cockpit-Aggregation ausgeschlossen werden (Analyse bleibt am Dokument).
alter table if exists public.documents
  add column if not exists exclude_from_steering_cockpit boolean not null default false;

comment on column public.documents.exclude_from_steering_cockpit is
  'Wenn true: Steuerungsanalyse bleibt am Dokument, fließt aber nicht in /se-cockpit-Aggregate ein.';
