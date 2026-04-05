-- Seed/Upsert fuer Dokumenttypen (FK-Zieltabelle documents.document_type_code -> document_types.code)
-- Idempotent: vorhandene Codes werden aktualisiert.

insert into public.document_types (code, label, default_protection_class)
values
  ('PROTOKOLL', 'Protokoll', 1),
  ('BESCHLUSSVORLAGE', 'Beschlussvorlage', 2),
  ('KONZEPT', 'Konzept', 1),
  ('CURRICULUM', 'Curriculum', 1),
  ('VEREINBARUNG', 'Vereinbarung', 2),
  ('ELTERNBRIEF', 'Elternbrief', 1),
  ('RUNDSCHREIBEN', 'Rundschreiben', 1),
  ('SITUATIVE_REGELUNG', 'Situative Regelung', 2)
on conflict (code) do update
set
  label = excluded.label,
  default_protection_class = excluded.default_protection_class;

