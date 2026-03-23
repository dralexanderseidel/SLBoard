# Berechtigungen und Zugriffsfilter

## Übersicht

- Zugriff erfolgt über **Schutzklasse (`protection_class_id`)** und **Rolle**.
- Zusätzlich bleibt `responsible_unit` für Bearbeitungs- und Organisationsbezug relevant.

### Schutzklassenmodell

| Schutzklasse | Bedeutung | Wer darf lesen |
|---|---|---|
| **1** | Öffentlich | alle angemeldeten Lehrkräfte/Nutzer |
| **2** | Verwaltung intern | nur **SEKRETARIAT** + **SCHULLEITUNG** |
| **3** | Streng vertraulich | nur **SCHULLEITUNG** |

### Technische Voraussetzung (Lookup-Tabelle)

`documents.protection_class_id` ist per Foreign Key mit `public.protection_classes(id)` verknüpft.  
Damit Schutzklasse **3** gespeichert werden kann, muss in `protection_classes` ein Eintrag mit `id = 3` vorhanden sein.

Beispiel (idempotent):

```sql
insert into public.protection_classes (id, name, description)
values (3, 'Nur Schulleitung', 'Zugriff nur für Schulleitung (SL).')
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description;
```

## Tabellen anlegen (SQL)

Die Tabellen können mit der Migration **`supabase/migrations/20250309_app_users_and_roles.sql`** angelegt werden.

**Option A – Supabase CLI (empfohlen):**

```bash
cd slboard
npx supabase db push
# bzw. supabase migration up
```

**Option B – SQL im Supabase Dashboard ausführen:**

Im Supabase-Projekt: **SQL Editor** → neues Query → Inhalt von `supabase/migrations/20250309_app_users_and_roles.sql` einfügen → Run.

**Inhalt der Migration (Auszug):**

- Erstellt `app_users` (id, username, full_name, email, org_unit, created_at) mit `email` unique.
- Erstellt `user_roles` (user_id, role_code) mit FK auf `app_users(id)` und Primary Key (user_id, role_code).
- Legt Indizes auf email, user_id, role_code an.

Danach Nutzer und Rollen über die **Admin-Oberfläche** (`/admin`) pflegen oder per SQL einfügen.

---

## Benötigte Tabellen in Supabase (Referenz)

### `app_users`

Jeder angemeldete Nutzer, der in der App erscheinen soll, braucht einen Eintrag. Die **E-Mail** sollte mit dem Supabase-Auth-Account übereinstimmen.

| Spalte        | Typ    | Beschreibung                          |
|---------------|--------|--------------------------------------|
| `id`          | uuid   | Primärschlüssel (z. B. `gen_random_uuid()`) |
| `username`    | text   | Anzeigename / Login-Name              |
| `full_name`   | text   | Vollständiger Name                    |
| `email`       | text   | E-Mail (wie in Supabase Auth)        |
| `org_unit`    | text   | Organisationseinheit (s. u.)         |
| `created_at`  | timestamptz | optional, z. B. `now()`          |

### `user_roles`

Rollen pro Nutzer.

| Spalte    | Typ  | Beschreibung        |
|-----------|------|---------------------|
| `user_id` | uuid | FK auf `app_users.id` |
| `role_code` | text | z. B. `SCHULLEITUNG`, `SEKRETARIAT`, `LEHRKRAFT` |

**Für den Zugriffsfilter relevant:**
- `SCHULLEITUNG` sieht Schutzklasse 1/2/3
- `SEKRETARIAT` sieht Schutzklasse 1/2
- andere Rollen sehen Schutzklasse 1

## Organisationseinheiten (org_unit / responsible_unit)

Die Werte müssen **identisch** sein, damit die Filterung greift. In der App werden u. a. verwendet:

- Schulleitung  
- Sekretariat  
- Fachschaft Deutsch  
- Fachschaft Mathematik  
- Fachschaft Englisch  
- Steuergruppe  
- Lehrkräfte  

Beim Anlegen von **Dokumenten** wird `responsible_unit` gesetzt; beim Anlegen/Bearbeiten von **Nutzer:innen** in der Admin-Oberfläche wird `org_unit` gesetzt.  
`responsible_unit` wird weiterhin für Organisationszuordnung und Bearbeitungslogik genutzt.

## Wo Nutzer und Rollen pflegen?

- **Admin-Oberfläche:** `/admin`  
  Dort können Sie Nutzer in `app_users` anlegen/bearbeiten und Rollen in `user_roles` zuweisen.  
- Die E-Mail der Nutzer sollte mit dem Supabase-Auth-Account übereinstimmen (gleiche E-Mail wie beim Login).

## Kurz-Check: Warum sehe ich keine / wenige Dokumente?

1. **Eintrag in `app_users`?**  
   Für die eingeloggte E-Mail muss ein Zeile in `app_users` existieren (E-Mail exakt gleich).

2. **Passende Rolle für Schutzklasse?**  
   - Schutzklasse 1: alle  
   - Schutzklasse 2: nur **SEKRETARIAT** oder **SCHULLEITUNG**  
   - Schutzklasse 3: nur **SCHULLEITUNG**

3. **Rollen zuweisen:**  
   Unter `/admin` bei dem Nutzer die Rolle(n) setzen.

## Audit-Log (Änderungsverlauf)

Die Tabelle **`audit_log`** protokolliert, wer wann was geändert hat (z. B. Status, Metadaten, neue Versionen). Migration: `supabase/migrations/20250309_audit_log.sql`. In der Dokumentdetailseite wird der Änderungsverlauf angezeigt, sofern Einträge vorhanden sind.

## Rechtsbezug (legal_reference)

- In der **Dokumentdetailseite** kann der Rechtsbezug bearbeitet werden: **„Bearbeiten“** klicken, Feld **„Rechtsbezug“** anpassen, **„Speichern“**.  
- Der Wert wird in `documents.legal_reference` gespeichert und in der Detailansicht (Leseansicht) angezeigt.
