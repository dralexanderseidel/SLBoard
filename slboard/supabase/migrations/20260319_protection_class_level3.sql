-- Ergänzt Schutzklasse 3 für das neue 3-Level-Modell.
-- Idempotent: Falls id=3 bereits existiert, werden Name/Beschreibung aktualisiert.
insert into public.protection_classes (id, name, description)
values (3, 'Nur Schulleitung', 'Zugriff nur für Schulleitung (SL).')
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description;

