# Berechtigungen und Zugriffsfilter

**Stand:** Abgleich mit `lib/documentAccess.ts`, `lib/adminAuth.ts`, `lib/superAdminAuth.ts` und den RLS-Migrationen in `supabase/migrations/`.

---

## Übersicht

Zugriff auf Dokumente und Aktionen hängt zusammen aus:

1. **Angemeldeter Supabase-User** (Session) und passender Zeile in **`app_users`** (gleiche E-Mail, passende **`school_number`** zum aktuellen Schul-Kontext).
2. **Mandant:** Datenzeilen der eigenen Schule (`school_number`) — serverseitig u. a. `canAccessSchool()`; in Postgres zusätzlich **RLS** für direkte Client-Zugriffe.
3. **Schutzklasse** (`documents.protection_class_id`) und **Rollen** in `user_roles` — Lesen über `canReadDocument()`.
4. **Bearbeiten / Version / Löschen / Bulk:** zusätzlich **Organisationsbezug** (`org_unit` des Nutzers vs. `responsible_unit` des Dokuments) und **Sonderrollen** Schulleitung/Sekretariat — vgl. u. a. `POST /api/documents/bulk-capabilities` und die jeweiligen API-Routen.

---

## Schul-Kontext (Multi-Tenant)

- Pro **E-Mail** kann es **mehrere** `app_users`-Zeilen geben (eine pro **`school_number`**).
- Der **aktive Mandant** kommt aus dem **HTTP-only-Cookie** (`slb_active_school`, siehe `lib/schoolSession.ts`) und wird mit **`auth.users.user_metadata.school_number`** abgestimmt (`POST /api/auth/set-school-context`).
- Ohne gültigen Kontext bei mehreren Schulen: `needsSchoolContext` — Nutzer muss den Kontext setzen (erneute Schulwahl / Anmeldung).

---

## Schutzklassenmodell (Lesen)

Implementierung: **`canReadDocument()`** in `lib/documentAccess.ts`.

| Schutzklasse | Bedeutung (Kurz) | Wer darf lesen |
|--------------|------------------|----------------|
| **1** | für Lehrkräfte sichtbar | Rolle **LEHRKRAFT** *oder* erweiterter Zugriff (siehe unten) |
| **2** | intern / eingeschränkt | **SCHULLEITUNG**, **SEKRETARIAT**, **VERWALTUNG**, **KOORDINATION** |
| **3** | streng | nur **SCHULLEITUNG** |

**Erweiterter Zugriff** (wie in Code für Stufe 2 genutzt): `isSchulleitung || isSekretariat || VERWALTUNG || KOORDINATION`.

**Fallback** für unbekannte oder fehlende Schutzklassen-Werte: restriktiv — u. a. Schulleitung, Sekretariat oder Übereinstimmung **`org_unit` === `responsible_unit`**.

### Technische Voraussetzung (Lookup-Tabelle)

`documents.protection_class_id` ist mit **`public.protection_classes(id)`** verknüpft. Für Stufe **3** muss ein Eintrag mit `id = 3` existieren (Migrationen / `20260319_protection_class_level3.sql`).

---

## Rollencodes (Referenz)

In der UI werden u. a. angezeigt: **SCHULLEITUNG**, **SEKRETARIAT**, **VERWALTUNG**, **KOORDINATION**, **LEHRKRAFT**, **FACHVORSITZ**, **STEUERGRUPPE**, **ADMIN**, **SUPER_ADMIN** (`UserMenu`, Seeds).

Für **Lesen** sind im Kern die in `canReadDocument` genannten Rollen maßgeblich; weitere Codes können für spätere Erweiterungen oder Anzeige genutzt werden.

### Schul-Admin (`/admin`, `/api/admin/*`)

- **`lib/adminAuth.ts`:** Rollen **SCHULLEITUNG** oder **ADMIN** im **aktuellen** Schul-Kontext (eindeutige `app_users`-Zeile zu E-Mail + `school_number`).
- Konto **`app_users.active === false`** → kein Admin-Zugriff.

### Super-Admin

- **`lib/superAdminAuth.ts`:** E-Mail in **`SUPER_ADMIN_EMAILS`** (Env, kommagetrennt) **oder** Rolle **`SUPER_ADMIN`** in `user_roles` (über `app_users` der E-Mail).
- Super-Admin-Routen: `/super-admin`, `/api/super-admin/*` (zusätzliche Prüfung in den Routes).

---

## Feature-Flags und Kontingente (pro Schule)

Auf **`schools`** u. a.:

- **`feature_ai_enabled`**, **`feature_drafts_enabled`** — KI- und Entwurfs-Endpunkte reagieren mit Sperre/Hinweis, wenn deaktiviert (`lib/schoolFeatureFlags.ts`).
- **`max_upload_file_mb`** — effektive Upload-Obergrenze (`effectiveMaxUploadBytes`); mit Plattform-Default, wenn `NULL`.
- **`active`** — `false` sperrt Nutzung der Schule (Redirect/Fehlercodes, siehe `proxy.ts` wenn als Middleware aktiv).

---

## Organisationseinheiten (`org_unit` / `responsible_unit`)

- **`documents.responsible_unit`:** zuständige Einheit des Dokuments (Filter, Anzeige „Verantwortlich“).
- **`app_users.org_unit`:** Einheit des Nutzers.
- Für **Bearbeitung** (u. a. Bulk): Schulleitung, Sekretariat **oder** `org_unit` === `responsible_unit` (siehe `bulk-capabilities/route.ts`).

Standardwerte für Auswahllisten kommen aus **`school_responsible_unit_options`** (Admin); historische Listen in Doku/Seeds können abweichen.

---

## Tabellen `app_users` und `user_roles`

### Wichtige Spalten `app_users` (aktueller Stand)

Neben `username`, `full_name`, `email`, `org_unit`, `created_at` u. a.:

- **`school_number`** — Mandant (FK `schools`).
- **`active`** — Konto deaktiviert: kein Zugriff wie ohne Zeile.
- **`password_change_required`** — erzwingt Passwortwechsel (`/change-password`), bis zurückgesetzt.

**Eindeutigkeit:** `(email, school_number)` — nicht mehr „eine E-Mail global“ (`20260410_app_users_email_school_unique_and_rls.sql`).

### `user_roles`

`(user_id, role_code)` mit FK auf `app_users.id`.

---

## Wo Nutzer und Rollen pflegen?

- **`/admin`** — CRUD Nutzer, Rollen (`PATCH …/roles`), sofern Schul-Admin.
- Supabase SQL nur in Ausnahmefällen; Migrationen für Schema.

---

## Kurz-Check: Warum sehe ich keine / wenige Dokumente?

1. **`app_users`:** Existiert eine Zeile für **E-Mail + aktuelle `school_number`** (Cookie/JWT)?
2. **`schools.active`:** Schule nicht deaktiviert?
3. **Schutzklasse und Rollen:** Entspricht Ihre Rolle der Tabelle oben (inkl. LEHRKRAFT für Stufe 1)?
4. **`responsible_unit` / Fallback:** Bei exotischen `protection_class_id`-Werten greift die restriktive Fallback-Regel (Org-Match oder SL/Sek).
5. **Archiv:** Dokumente mit **`archived_at`** erscheinen nur in der Archiv-Ansicht (`?archive=1`).

---

## Audit-Log

- Tabelle **`audit_log`** (inkl. **`school_number`** in Multi-Tenant).
- Anzeige: Dokumentdetail „Änderungsverlauf“ (`GET /api/documents/[id]/audit`).
- Optional Legacy-Tabelle **`audit_logs`** — Bereinigung beim Dokument-Löschen best-effort.

---

## DSGVO / Kontodaten

- **Datenexport:** `GET /api/me/export` (aggregiert personenbezogene/app-bezogene Daten, serverseitig).
- **Löschanfrage:** `POST /api/me/delete-request` → **`account_delete_requests`**; Bearbeitung nur durch Admin über Service-Role / Admin-APIs. **Kein automatisches Löschen** durch diese Anfrage allein.

---

## RLS (Row Level Security) — Kurz

- Kern-Tabellen (`documents`, `document_versions`, `app_users`, `user_roles`, `audit_log`, `ai_queries`, …) haben Mandanten-Policies (`current_school_number()`, Admin-Varianten), siehe `20260320_multitenant_rls.sql` und Folgemigrationen.
- **`schools`:** Lesen für Mitglieder der Schule und Super-Admin-Rolle in DB — `20260426120000_rls_schools_audit_logs_account_delete_requests.sql`.
- **`account_delete_requests`:** kein direkter `authenticated`-Zugriff; nur Backend **`service_role`** (RLS + REVOKE/GRANT in Migration).
- **Service-Role-Client** in API-Routen **umgeht RLS** — deshalb sind die expliziten Prüfungen in `documentAccess` / den Routes weiterhin Pflicht.

---

## Rechtsbezug (`legal_reference`)

Wie in der Funktionsübersicht: Bearbeiten auf der Dokumentdetailseite, Speicherung in `documents.legal_reference`.
