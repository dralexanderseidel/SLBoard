-- Ergaenzt den Dokumenttyp "Situative Regelung" fuer bestehende Installationen.
-- Idempotent: vorhandener Code wird aktualisiert.

insert into public.document_types (code, label, default_protection_class)
values ('SITUATIVE_REGELUNG', 'Situative Regelung', 2)
on conflict (code) do update
set
  label = excluded.label,
  default_protection_class = excluded.default_protection_class;
