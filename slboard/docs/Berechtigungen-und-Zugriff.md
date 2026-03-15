# Berechtigungen und Zugriffsfilter

## Übersicht

- **Dokumentenliste** und **Dateizugriff** (Storage) werden nach **Organisationseinheit** und **Rolle** gefiltert.
- Schulleitung und Sekretariat sehen **alle** Dokumente; alle anderen Nutzer nur Dokumente ihrer **eigenen Organisationseinheit**.

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

Rollen pro Nutzer. Nur Nutzer mit **SCHULLEITUNG** oder **SEKRETARIAT** sehen alle Dokumente.

| Spalte    | Typ  | Beschreibung        |
|-----------|------|---------------------|
| `user_id` | uuid | FK auf `app_users.id` |
| `role_code` | text | z. B. `SCHULLEITUNG`, `SEKRETARIAT`, `LEHRKRAFT` |

**Für den Zugriffsfilter relevant:** Nur `SCHULLEITUNG` und `SEKRETARIAT` bewirken „sieht alle Dokumente“. Alle anderen (oder ohne Eintrag) sehen nur Dokumente, bei denen `documents.responsible_unit` = `app_users.org_unit` ist.

## Organisationseinheiten (org_unit / responsible_unit)

Die Werte müssen **identisch** sein, damit die Filterung greift. In der App werden u. a. verwendet:

- Schulleitung  
- Sekretariat  
- Fachschaft Deutsch  
- Fachschaft Mathematik  
- Fachschaft Englisch  
- Steuergruppe  
- Lehrkräfte  

Beim Anlegen von **Dokumenten** wird `responsible_unit` gesetzt; beim Anlegen/Bearbeiten von **Nutzer:innen** in der Admin-Oberfläche wird `org_unit` gesetzt. Nur wenn diese Werte exakt übereinstimmen, sieht ein Nutzer das Dokument in der Liste (sofern er nicht Schulleitung/Sekretariat ist).

## Wo Nutzer und Rollen pflegen?

- **Admin-Oberfläche:** `/admin`  
  Dort können Sie Nutzer in `app_users` anlegen/bearbeiten und Rollen in `user_roles` zuweisen.  
- Die E-Mail der Nutzer sollte mit dem Supabase-Auth-Account übereinstimmen (gleiche E-Mail wie beim Login).

## Kurz-Check: Warum sehe ich keine / wenige Dokumente?

1. **Eintrag in `app_users`?**  
   Für die eingeloggte E-Mail muss ein Zeile in `app_users` existieren (E-Mail exakt gleich).

2. **Passende `org_unit`?**  
   Dokumente haben ein Feld `responsible_unit`. Sie sehen nur Dokumente, bei denen  
   `responsible_unit` = Ihre `org_unit` ist – außer Sie haben die Rolle **SCHULLEITUNG** oder **SEKRETARIAT**.

3. **Rollen zuweisen:**  
   Unter `/admin` bei dem Nutzer die Rolle(n) setzen. „Sieht alle Dokumente“ nur bei **SCHULLEITUNG** oder **SEKRETARIAT**.

## Audit-Log (Änderungsverlauf)

Die Tabelle **`audit_log`** protokolliert, wer wann was geändert hat (z. B. Status, Metadaten, neue Versionen). Migration: `supabase/migrations/20250309_audit_log.sql`. In der Dokumentdetailseite wird der Änderungsverlauf angezeigt, sofern Einträge vorhanden sind.

## Rechtsbezug (legal_reference)

- In der **Dokumentdetailseite** kann der Rechtsbezug bearbeitet werden: **„Bearbeiten“** klicken, Feld **„Rechtsbezug“** anpassen, **„Speichern“**.  
- Der Wert wird in `documents.legal_reference` gespeichert und in der Detailansicht (Leseansicht) angezeigt.
