# log/os Edu Governance Pro – Funktionsübersicht

Detaillierte Beschreibung der Funktionsweise der Anwendung (**Stand: Abgleich mit dem Code in `slboard/`**, Next.js App Router).

---

## 1. Technologie und Architektur

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes (serverseitig)
- **Datenbank & Auth:** Supabase (PostgreSQL, Auth, Storage)
- **Multi-Tenant:** Mandant über `school_number` (6 Ziffern); Daten und Storage-Pfade sind schulbezogen
- **KI:** LLM-Anbindung über Umgebungsvariablen (OpenAI-kompatible API); Aufrufe in `lib/llmClient.ts`
- **Text-Extraktion:** PDF (`pdf-parse`), Word (`mammoth`) in `lib/documentText.ts`

Die App läuft als klassische Web-App: Nutzer arbeiten im Browser; API-Aufrufe laufen über dieselbe Origin. Serverseitige DB-/Storage-Zugriffe nutzen typischerweise den **Service-Role-Client** (`lib/supabaseServer.ts`); direkte Client-Zugriffe werden durch **RLS** in Supabase abgesichert.

**Hinweis Routing-Schutz:** In `slboard/proxy.ts` liegt eine vollständige **Middleware-Logik** (Session, öffentliche Pfade, Schul-/Kontostatus, Passwortänderungspflicht, `matcher`). Für deren Aktivierung ist in Next.js üblicherweise ein `middleware.ts` nötig, das diese Funktion exportiert — unabhängig davon prüfen die **API-Routen** Session und Rechte eigenständig.

---

## 2. Authentifizierung und Schul-Kontext

- **Supabase Auth:** Anmeldung mit E-Mail/Passwort (weitere Provider je Supabase-Konfiguration).
- **Seiten:** `/login`; geschützte Bereiche erwarten eine Session (`createServerSupabaseClient()`, `getUser()`).
- **App-Nutzerverwaltung:** Tabellen `app_users` und `user_roles`. Die Auth-E-Mail entspricht `app_users.email` (normalisiert, z. B. kleingeschrieben). **E dieselbe E-Mail kann mehrere Zeilen in `app_users` haben** (eine pro `school_number`).
- **Aktiver Schul-Kontext:** HTTP-only-Cookie (z. B. `slb_active_school`, siehe `lib/schoolSession.ts`) und Abgleich mit `auth.users.user_metadata.school_number`. Setzen und Validierung über **`POST /api/auth/set-school-context`** (Existenz der `app_users`-Zeile, Schule aktiv, Konto aktiv).
- **Abmeldung:** u. a. `DELETE /api/auth/set-school-context` (Cookie löschen) und Supabase `signOut` (`UserMenu`).
- **Passwort ändern:** Seite `/change-password`, API **`POST /api/auth/change-password`**. Ist `app_users.password_change_required` gesetzt, kann die App weitere Routen sperren (siehe Middleware-Logik in `proxy.ts`).

Öffentlich ohne Login u. a.: `/login`, `/register-school`, `/hilfe`, `/datenschutz`, `/impressum`.

---

## 3. Navigation und Seiten

| Route | Beschreibung |
|-------|--------------|
| **/** | **Startseite:** KI-Suche (Dokumente vorschlagen → auswählen → Frage beantworten), Verlauf „Aktuelle Anfragen“, Hinweise „Neu veröffentlicht“ / überfällige Review-Termine (über **`GET /api/notifications`** o. ä.), Kacheln u. a. zu Dokumente, Upload, Entwürfe, Steuerungs-Cockpit |
| **/se-cockpit** | **Steuerungs-Cockpit:** aggregierte Darstellung aus gespeicherten Steuerungsanalysen der Schule (**`GET /api/se-cockpit`**) |
| **/documents** | Dokumentenliste: Filter (u. a. Typ, Status, Schutzklasse, Reichweite (`reach_scope`), Beteiligungsgruppen, Gremium, Review (`review`-Parameter), Suche); **Archiv** über Query `?archive=1`; Mehrfachauswahl und **Bulk-Aktionen** (Workflow, Löschen, Archiv, ggf. KI-Batch) |
| **/documents/[id]** | Dokumentdetail: Metadaten, Workflow (inkl. Zwischenstatus **Beschluss**), Versionen, Vorschau/Download, Bearbeiten, Rechtsbezug, KI-Zusammenfassung, Entwurfs-Hilfen, **Steuerungsanalyse** / **To-dos** (KI), Schulentwicklungs-/Matrix-Felder (je nach Migration), Änderungsverlauf (`audit_log`), Löschen |
| **/upload** | Neues Dokument aus Datei (PDF/Word): Titel, Typ, Datum, Status, Schutzklasse, Reichweite, Gremium, Zuständige Organisationseinheit, Beteiligungsgruppen |
| **/drafts** | Entwurfsassistent: u. a. Elternbrief (**`/api/ai/drafts/parent-letter`**) und **dokumenttypbezogene KI-Entwürfe** (**`/api/ai/drafts/document`**); Speichern über **`/api/drafts/save`**. Bei `feature_drafts_enabled = false` entfällt die Navigation |
| **/admin** | Schul-Admin: Nutzer/Rollen, Metadatenlisten, KI-Einstellungen, **KI-Prompt-Vorlagen**, Statistiken, Reindex, **Löschanfragen** (DSGVO) — nur **SCHULLEITUNG** oder **ADMIN** im aktuellen Schul-Kontext |
| **/super-admin** | Super-Admin: Schulverwaltung (nur sichtbar mit Super-Admin-Recht: Rolle **SUPER_ADMIN** in `user_roles` und/oder E-Mail in **`SUPER_ADMIN_EMAILS`**) |
| **/register-school** | Öffentliche **Selbstregistrierung** einer Schule inkl. erstem Schuladmin (**`/api/onboarding/register-school`**) |
| **/change-password** | Passwortwechsel (u. a. bei erzwungener Änderung) |
| **/login** | Anmeldung |
| **/hilfe** | Hilfe/Dokumentation (Inhaltsverzeichnis, u. a. Steuerungs-Cockpit) |
| **/datenschutz** | Datenschutzhinweise |
| **/impressum** | Impressum |

**Navigation:** Gemeinsame Shell (`AppChrome`): mobil oben, ab Desktop linke Sidebar mit u. a. Startseite, Steuerungs-Cockpit, Dokumente, Entwurfsassistent (optional), Hilfe, Admin, Super-Admin (bedingt). Logo/Marke **log/os**.

---

## 4. Dokumentenmodell und Workflow

### 4.1 Dokument (`documents`)

- **Kernfelder (Auszug):** `id`, `title`, `document_type_code`, `created_at`, `status`, `protection_class_id`, `responsible_unit`, `gremium`, `participation_groups`, `reach_scope`, `legal_reference`, `summary`, `school_number`, `current_version_id`, `created_by_id`, `responsible_person_id`, `review_date`, `archived_at`, KI-/Steuerungsfelder (`steering_analysis`, `steering_todos`, `steering_analysis_updated_at`, …), ggf. schulentwicklungsbezogene Spalten (siehe Migrationen ab `20260503…`).
- **Anzeige in der UI:** „Verantwortlich“ = `responsible_unit`, „Beschlussgremium“ = `gremium`, „Beteiligung“ = `participation_groups`, „Reichweite“ = `reach_scope` (`intern` \| `extern`).
- **Dokumenttypen:** mandantenspezifisch in `school_document_type_options`; globale Referenz `document_types`.
- **Status-Workflow (nur jeweils ein Schritt vorwärts, vgl. `lib/documentWorkflow.ts`):**
  - **ENTWURF** → **FREIGEGEBEN** (Anzeige: „In Abstimmung“, Aktion: „Zur Abstimmung freigeben“)
  - **FREIGEGEBEN** → **BESCHLUSS** („Beschluss fassen“)
  - **BESCHLUSS** → **VEROEFFENTLICHT** („Veröffentlichen“)
  - **VEROEFFENTLICHT:** Endstatus für weitere Workflow-Schritte
- Status wird über die vorgesehenen Aktionen/API-Validierung gesetzt, nicht beliebig per Freitext.

**Archiv:** `archived_at` gesetzt → Dokument erscheint im Archiv-Modus der Liste; Logik und KI-Pool entsprechend eingeschränkt (siehe API-Kommentare und Migrationen).

### 4.2 Versionen (`document_versions`)

- Mehrere Versionen pro Dokument (`version_number`, `created_at`, `comment`, `file_uri`, `mime_type`, …).
- **Historie:** `GET /api/documents/[id]/versions`
- **Download/Vorschau:** `GET /api/documents/[id]/file?versionId=…`
- **Neue Version:** `POST /api/documents/[id]/version` → Storage + Eintrag in `document_versions`, Aktualisierung `current_version_id`, Audit **version.upload**

### 4.3 Dateispeicher

- Supabase Storage, Bucket `documents`; Pfade enthält `school_number`.
- Auslieferung über signierte URLs / File-Route; Berechtigung über App-Logik (`documentAccess`) und Storage-Policies (u. a. „documents_select_by_unit“ in Migrationen).

---

## 5. Berechtigungen und Zugriffsfilter

- **Schutzklassen (`protection_class_id`):** wie in `canReadDocument` (`lib/documentAccess.ts`):
  - **1:** Lehrkräfte sowie rollen mit erweitertem Zugriff (Schulleitung, Sekretariat, Verwaltung, Koordination)
  - **2:** Schulleitung, Sekretariat, Verwaltung, Koordination
  - **3:** nur Schulleitung
- **Mandant:** Zugriff nur auf Zeilen der eigenen `school_number`, sobald der Schul-Kontext aufgelöst ist.
- **Bearbeiten / Löschen / Version / Bulk:** zusätzlich organisationsbezogen (u. a. Schulleitung, Sekretariat oder `org_unit` = `responsible_unit`); Vorauswahl der bearbeitbaren IDs über **`POST /api/documents/bulk-capabilities`**.
- **Schul-Admin (`/admin`, `/api/admin/*`):** Rollen **SCHULLEITUNG** oder **ADMIN** (`lib/adminAuth.ts`).
- **Super-Admin:** `lib/superAdminAuth.ts` (E-Mail-Whitelist + Rolle `SUPER_ADMIN`).
- **Feature-Flags pro Schule:** u. a. `feature_ai_enabled`, `feature_drafts_enabled`, `max_upload_file_mb` auf `schools` — wirken auf KI-, Entwurfs- und Upload-Pfade (`lib/schoolFeatureFlags.ts`, `GET /api/me/access`).

Details: `docs/Berechtigungen-und-Zugriff.md`.

---

## 6. API-Routen (Überblick)

### 6.1 Dokumente

| Methode | Route | Funktion |
|---------|--------|----------|
| GET | `/api/documents` | Liste mit Filtern (u. a. `type`, `responsibleUnit`, `status`, `protectionClass`, `search`, `reachScope`, `participation`, `gremium`, `review`, Archiv-Flag); Berechtigungsfilter; gekürzte Summary für Liste |
| GET | `/api/documents/[id]/detail` | aggregierte Detaildaten (Parallel-Load von Metadaten, Versionen, Audit, …) |
| PATCH | `/api/documents/[id]` | Metadaten/Status; Workflow nur erlaubte Übergänge; Audit `document.update` |
| DELETE | `/api/documents/[id]` | Dokument inkl. Versionen, Storage, Audit-Einträge (inkl. Legacy-Tabelle `audit_logs` best-effort), bereinigende RPCs für KI-Historie |
| GET | `/api/documents/[id]/file` | Datei (aktuelle oder angegebene Version) |
| GET | `/api/documents/[id]/versions` | Versionsliste |
| POST | `/api/documents/[id]/version` | neue Version; Audit `version.upload` |
| GET | `/api/documents/[id]/audit` | Änderungsverlauf (`audit_log`) |
| GET | `/api/documents/[id]/extract-text` | Textextraktion / Diagnose (`hasText`, Länge, ggf. Debug) |
| POST | `/api/documents/[id]/steering-analysis` | KI „Analyse des Steuerungsbedarfs“, Persistenz in `steering_analysis` |
| POST | `/api/documents/[id]/steering-todos` | KI-Vorschläge für To-dos, Persistenz in `steering_todos` |
| POST | `/api/documents/bulk-capabilities` | liefert für ID-Liste, welche Dokumente im aktuellen Kontext bulk-bearbeitet werden dürfen |

### 6.2 Upload, Entwurf, Zusammenfassung

| Methode | Route | Funktion |
|---------|--------|----------|
| POST | `/api/upload` | neues Dokument mit Datei; Metadaten inkl. Reichweite/Beteiligung; optional KI/Index |
| POST | `/api/drafts/save` | Entwurf als Dokument mit erster Version (u. a. `.txt` im Storage) |
| POST | `/api/summarize` | KI-Kurzfassung → `documents.summary` |
| POST | `/api/summarize-batch` | Batch-Zusammenfassung mehrerer Dokumente |

### 6.3 KI und Steuerung

| Methode | Route | Funktion |
|---------|--------|----------|
| POST | `/api/ai/suggest-documents` | Dokumentvorschläge ohne LLM (Scores/Snippets) |
| POST | `/api/ai/query` | KI-Antwort mit optionalen `documentIds` |
| POST | `/api/ai/drafts/parent-letter` | KI-Entwurf Elternbrief |
| POST | `/api/ai/drafts/document` | KI-Entwurf entlang dokumenttypbezogener Vorlage |
| GET | `/api/se-cockpit` | Aggregation gültiger Steuerungsanalysen für die Schule |

### 6.4 Auth, Profil, DSGVO

| Methode | Route | Funktion |
|---------|--------|----------|
| POST | `/api/auth/set-school-context` | Schulnummer setzen (Cookie + `user_metadata`) |
| DELETE | `/api/auth/set-school-context` | Kontext-Cookie löschen |
| POST | `/api/auth/change-password` | Passwort ändern |
| GET | `/api/me/access` | Schulname, Rollen, Super-Admin, Feature-Flags, Kontingente-Hinweise |
| GET | `/api/me/export` | Datenexport (JSON) |
| POST | `/api/me/delete-request` | Löschanfrage anlegen (`account_delete_requests`) |
| POST | `/api/onboarding/register-school` | neue Schule + Initial-Admin |

### 6.5 Metadaten, Benachrichtigungen

| Methode | Route | Funktion |
|---------|--------|----------|
| GET | `/api/metadata/options` | Dropdown-Optionen (Dokumenttypen, Zuständigkeiten) für die Schule |
| GET | `/api/notifications` | bündelt u. a. „kürzlich veröffentlicht“ (über `audit_log`) und überfällige `review_date` |
| GET | `/api/notifications/recently-published` | Teilliste (optional direkt nutzbar) |
| GET | `/api/notifications/review-overdue` | Teilliste überfälliger Reviews |

### 6.6 Schul-Admin

| Methode | Route | Funktion |
|---------|--------|----------|
| GET | `/api/admin/users` | Nutzerliste |
| POST | `/api/admin/users` | Nutzer anlegen |
| PATCH | `/api/admin/users/[id]` | Nutzer bearbeiten |
| DELETE | `/api/admin/users/[id]` | Nutzer löschen |
| PATCH | `/api/admin/users/[id]/roles` | Rollen setzen |
| GET | `/api/admin/metadata` | Metadaten-Optionen lesen |
| PUT | `/api/admin/metadata` | Metadaten-Optionen schreiben |
| GET | `/api/admin/ai-settings` | KI-Einstellungen / Schulprofil |
| PUT | `/api/admin/ai-settings` | KI-Einstellungen schreiben |
| GET | `/api/admin/ai-prompts` | Prompt-Vorlagen |
| PUT | `/api/admin/ai-prompts` | Prompt-Vorlagen speichern |
| DELETE | `/api/admin/ai-prompts` | Prompt-Vorlage löschen |
| POST | `/api/admin/ai-prompts/preview` | Vorschau gerenderter Prompts |
| GET | `/api/admin/stats` | Statistiken |
| POST | `/api/admin/reindex` | Suchindex/Indexierung |
| GET | `/api/admin/delete-requests` | Löschanfragen der Schule |
| PATCH | `/api/admin/delete-requests/[id]` | Status/Bearbeitung Löschanfrage |

### 6.7 Super-Admin

| Methode | Route | Funktion (kurz) |
|---------|--------|------------------|
| GET | `/api/super-admin/check` | Berechtigung für Super-Admin-UI |
| GET/POST | `/api/super-admin/schools` | Schulen auflisten/anlegen |
| GET/PATCH/DELETE | `/api/super-admin/schools/[schoolNumber]` | Schule bearbeiten/löschen |
| POST | `/api/super-admin/schools/[schoolNumber]/reset-initial-admin-password` | Initial-Admin-Passwort zurücksetzen |

---

## 7. KI-Funktionen im Detail

### 7.1 Startseite – KI-Suche (Zwei-Schritt)

1. **Schritt 1:** Frage eingeben → **`POST /api/ai/suggest-documents`** → Liste mit Checkboxen und Snippets.
2. **Schritt 2:** Auswahl → **`POST /api/ai/query`** mit `question` und `documentIds` (oder ohne IDs → serverseitige Kontextwahl).

KI kann pro Schule über **`feature_ai_enabled`** abgeschaltet werden.

### 7.2 Kontextbildung

Priorität u. a.: `summary` → Volltext aus Datei → `legal_reference`; Chunking für lange Texte (`lib/chunkingOnTheFly.ts` u. a.).

### 7.3 Entwurfsassistent

- Elternbrief: **`/api/ai/drafts/parent-letter`**
- Dokumenttypbezogen: **`/api/ai/drafts/document`**
- Persistenz: **`/api/drafts/save`**

### 7.4 Dokumentdetail – Zusammenfassung & Steuerung

- **Zusammenfassung:** **`POST /api/summarize`**
- **Steuerungsanalyse / To-dos:** siehe **`steering-analysis`** / **`steering-todos`**
- **Steuerungs-Cockpit:** Auswertung gespeicherter Analysen über **`GET /api/se-cockpit`**

---

## 8. Audit-Log

- **Tabelle:** `audit_log` (u. a. `user_email`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `created_at`, `school_number`).
- **Ereignisse:** u. a. **`document.update`** (PATCH), **`version.upload`** (neue Version).
- **UI:** Block „Änderungsverlauf“ auf der Dokumentdetailseite.
- **Benachrichtigung „Neu veröffentlicht“:** Ableitung aus `audit_log`, wenn `status` auf **VEROEFFENTLICHT** wechselt.

**Hinweis:** In manchen Datenbanken existiert zusätzlich eine Legacy-Tabelle **`audit_logs`**; beim Löschen eines Dokuments wird deren Bereinigung best-effort versucht.

---

## 9. Datenbank und Migrationen (Kurzüberblick)

Wesentliche Tabellen/Strukturen (Auszug):

- **`schools`:** Stammdaten, Aktiv-Flag, Quotas, Feature-Flags, Profiltext, Datenschutz-Zeitstempel …
- **`documents`**, **`document_versions`:** Kerngeschäftsobjekte
- **`app_users`**, **`user_roles`:** Nutzer pro Schule und Rollen
- **`audit_log`:** Änderungsprotokoll
- **`ai_queries`:** gespeicherte KI-Fragen für Verlauf/„Aktuelle Anfragen“
- **`ai_settings`**, **`school_ai_prompt_templates`:** KI-Konfiguration und Prompts pro Schule
- **`school_document_type_options`**, **`school_responsible_unit_options`:** Admin-Metadaten
- **`account_delete_requests`:** DSGVO-Löschanfragen (Bearbeitung durch Admin)
- **`ai_llm_calls`:** optional Logging von LLM-Aufrufen

Migrationen unter `supabase/migrations/` (Multi-Tenant, RLS, Archiv, Workflow-Status **BESCHLUSS**, DSGVO, Feature-Flags, SchulRLS-Policies u. a. in `20260426120000_…`).

---

## 10. UI-Besonderheiten

- **Shell:** Responsive Navigation (mobil oben, Desktop Sidebar), Globale Suche (`GlobalSearch`), `UserMenu` mit Rollenanzeige, Export, Löschanfrage, Passwort ändern.
- **Rechtsbezug** und **Versionen:** wie zuvor; Bearbeitungsmodus für Langtext.
- **Hintergrund:** helles Zinc-Schema mit kontrastierenden Karten.
- **Marke:** log/os-Logo und PNG-Varianten in der Sidebar (`/log-os-logo-dark.png`).

---

## 11. Abhängigkeiten (Umgebung)

- **Supabase:** Projekt-URL, **anon key** (Client), **service role key** (nur Server)
- **LLM:** URL, Key, Modell — siehe `lib/llmClient.ts` / `ai_settings`
- **Super-Admin-Whitelist:** `SUPER_ADMIN_EMAILS` (kommagetrennt, optional)

Ohne LLM schlagen KI-Endpunkte fehl; Dokumentenverwaltung und Rechte funktionieren unabhängig davon.
