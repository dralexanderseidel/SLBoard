-- Dokument-Metadatum: Beteiligung (mehrere Gruppen)
alter table public.documents
add column if not exists participation_groups text[] not null default '{}';
