# log/os Edu Governance Pro – Implementierte Logik (Detail)

**Stand:** Abgleich mit dem Code unter `slboard/` (Next.js App Router). Ergänzt **`docs/Funktionsuebersicht.md`** und **`docs/Berechtigungen-und-Zugriff.md`** um Implementierungsdetails.

---

## 1. Grundprinzipien

- Next.js **App Router**: UI unter `app/`, APIs unter `app/api/`.
- **Supabase:** Auth (Session/Cookies), Postgres, Storage.
- **Multi-Tenant** über **`school_number`** (6 Ziffern) auf Kern-Tabellen.
- Serverseitig typischerweise **`supabaseServer()`** (Service Role) für DB/Storage; zusätzlich **`createServerSupabaseClient()`** für `auth.getUser()`.
- Fehlerantworten über **`lib/apiError.ts`** (einheitliche JSON-Struktur).
- Optionaler **Request-Guard** in **`proxy.ts`** (Session, öffentliche Pfade, Schul-/Kontostatus, Passwortpflicht, `matcher`) — bei Bedarf als Next-**`middleware`** einbinden; APIs validieren unabhängig davon.

---

## 2. Mandantenfähigkeit (Multi-Tenant)

### 2.1 Tenant-Key

- **`school_number`** `char(6)`, FK auf **`schools`**.
- u. a. **`documents`**, **`document_versions`**, **`audit_log`**, **`app_users`**, **`ai_queries`**, **`ai_settings`**, Schul-Metadaten-Tabellen.

### 2.2 Kontext im Code

- **`getUserAccessContext(authEmail, supabase, activeSchoolNumber?)`** und **`resolveUserAccess()`** laden `app_users` + `user_roles` und prüfen Schul-Aktivität (`lib/documentAccess.ts`).
- Aktive Schule: Cookie **`slb_active_school`** (`lib/schoolSession.ts`) + Abgleich mit JWT-Metadaten nach **`POST /api/auth/set-school-context`**.

### 2.3 RLS

- Mandanten-Policies u. a. in **`20260320_multitenant_rls.sql`** (`current_school_number()`, `current_is_admin()`).
- **`schools`**, Legacy **`audit_logs`**, **`account_delete_requests`:** **`20260426120000_rls_schools_audit_logs_account_delete_requests.sql`** (inkl. `current_is_super_admin()` für Schul-Lesezugriff Super-Admin per DB-Rolle).
- **Service Role umgeht RLS** — App-Logik bleibt maßgeblich.

---

## 3. Authentifizierung, Rollen, Sonderfälle

- Login: Supabase Auth; **`/login`**, **`LoginPageClient`**.
- Mehrere Schulen pro E-Mail: ohne Cookie/Kontext → **`needsSchoolContext`**.
- **`password_change_required`:** UI **`/change-password`**, API **`POST /api/auth/change-password`**; Blockade weiterer Routen über **`proxy.ts`** (wenn aktiv).
- **Schul-Admin:** `lib/adminAuth.ts` — **SCHULLEITUNG** | **ADMIN**, Kontext Pflicht bei mehreren Zeilen.
- **Super-Admin:** `lib/superAdminAuth.ts` — Env **`SUPER_ADMIN_EMAILS`** oder Rolle **SUPER_ADMIN**.

---

## 4. Dokumentmodell und Dateien

### 4.1 `documents` (Auszug)

- **`status`:** `ENTWURF` → **`FREIGEGEBEN`** (UI: „In Abstimmung“) → **`BESCHLUSS`** → **`VEROEFFENTLICHT`** (ein Schritt; `lib/documentWorkflow.ts`, Validierung in **`app/api/documents/[id]/route.ts`**).
- **`archived_at`:** Archiv-Liste / eingeschränkte Nutzung (`20260407_documents_archive_ai_queries_cleanup.sql`).
- **`participation_groups`**, **`reach_scope`** (`intern`|`extern`), **`gremium`**, **`review_date`**.
- **`steering_analysis`**, **`steering_analysis_updated_at`**, **`steering_analysis_version_id`**, **`steering_todos`** — KI/Persistenz.
- Schulentwicklungs-/Matrix-Felder: siehe Migration **`20260503120000_documents_schulentwicklung_fields.sql`** und **`lib/steeringAnalysisV2.ts`**.
- **Suche:** u. a. **`search_text`**, **`keywords`**, **`indexed_at`** (`lib/indexing.ts`).

### 4.2 `document_versions`

- Mehrere Versionen; Storage-Pfad enthält **`school_number`**.

### 4.3 Storage

- Bucket **`documents`** (privat), Auslieferung über **`GET /api/documents/[id]/file`** (signierte URLs).

### 4.4 Detail-Aggregation

- **`GET /api/documents/[id]/detail`** lädt gebündelt relevante Daten (parallel), um die Detailseite zu entlasten.

---

## 5. Workflow (Status)

- Erlaubte Übergänge nur **einen Schritt vor** in der Kette (siehe **`allowedNextStatuses`**).
- **Audit:** `document.update` bei PATCH; **`version.upload`** bei neuer Version (`audit_log`).
- Dashboard-Hinweis „neu veröffentlicht“: **`audit_log`** mit Wechsel nach **`VEROEFFENTLICHT`** (`/api/notifications`, Teile auch **`recently-published`**).

---

## 6. Listen, Filter, Bulk

- **`GET /api/documents`:** Filter u. a. Typ, Status, Schutzklasse, Reichweite, Beteiligungsgruppen, Gremium, Review (`overdue`|`set`|`empty`), Volltext/Metadaten; Archiv-Query-Parameter; gekürzte **`summary`** in der Liste.
- **`POST /api/documents/bulk-capabilities`:** für gewählte IDs die **eigentlich bearbeitbaren** Dokumente (Schule, Leserecht, Org/SL/Sek).
- Client: Mehrfachauswahl, Stapel-Workflow, -Löschen, -Archiv, ggf. KI-Batch (`summarize-batch`).

---

## 7. Metadaten pro Schule

- Tabellen: **`school_document_type_options`**, **`school_responsible_unit_options`** (`20260402_school_metadata_options.sql`; Draft-Spalten ggf. **`20260414_draft_config_per_doc_type.sql`**).
- **`GET /api/metadata/options`** — Dropdowns für Upload/UI.
- **`GET` / `PUT` `/api/admin/metadata`** — Admin-Pflege (**`PUT`**, nicht PATCH).

---

## 8. Suche und Indexing

- **`lib/indexing.ts`:** `keywords`, `search_text` aus Titel, Metadaten, Extrakt, Summary, …
- Anstöße: **`POST /api/upload`**, **`POST /api/documents/[id]/version`**, **`POST /api/admin/reindex`**.
- Bei Dokument-Löschung: u. a. RPC **`delete_ai_queries_referencing_document`** (Migration `20260407_…`).

---

## 9. KI

- **Chunking:** `lib/chunkingOnTheFly.ts`; Einstellungen **`ai_settings`**.
- **Routen (Auszug):** **`/api/ai/suggest-documents`**, **`/api/ai/query`**, **`/api/ai/drafts/parent-letter`**, **`/api/ai/drafts/document`**, **`/api/summarize`**, **`/api/summarize-batch`**.
- **Steuerung:** **`POST /api/documents/[id]/steering-analysis`**, **`POST /api/documents/[id]/steering-todos`** — JSON-Validierung/Repair (`steeringAnalysisV2`).
- **Cockpit:** **`GET /api/se-cockpit`** + **`lib/seCockpitAggregates.ts`**.
- **Quotas / Abschaltung:** `lib/quotaCheck.ts`, **`loadSchoolFeatureFlags`**, Debug **`lib/aiQueryDebugLog.ts`**.
- Logging: optional **`ai_llm_calls`** (`20260412_ai_llm_calls.sql`).

---

## 10. Entwürfe und Onboarding

- **`/drafts`**, **`POST /api/drafts/save`** — persists als Dokument + erste Version.
- **Selbstregistrierung Schule:** **`POST /api/onboarding/register-school`**, **`lib/schoolProvisioning.ts`** (Schule, Auth-User, `app_users`, Rolle Schulleitung, Default-Metadaten, `privacy_policy_accepted_at` über Provision-Parameter).

---

## 11. Benachrichtigungen

- **`GET /api/notifications`** — bündelt u. a. kürzlich veröffentlichte Dokumente (über **`audit_log`**) und überfällige **`review_date`** für veröffentlichte, nicht archivierte Dokumente.
- Teilendpunkte **`recently-published`**, **`review-overdue`** weiter nutzbar.

---

## 12. Profil, DSGVO, Schul-Admin, Super-Admin

- **`GET /api/me/access`** — `lib/meAccessServer.ts` / Header-Bootstrap.
- **`GET /api/me/export`**, **`POST /api/me/delete-request`**.
- **Admin:** Nutzer/Rollen (**`PATCH`** Rollen), **`PUT`** Metadata/AI/Prompts, **Stats**, **Reindex**, **Delete-Requests** (`/api/admin/delete-requests`, `/api/admin/delete-requests/[id]`).
- **Super-Admin:** **`/api/super-admin/*`** — Schulen CRUD, Passwort-Reset Initial-Admin, **`check`**.

---

## 13. Vorschau und Text

- Datei: **`GET /api/documents/[id]/file`** (`versionId` optional).
- Extraktion/Diagnose: **`GET /api/documents/[id]/extract-text`**.

---

## 14. Audit

- **`audit_log`** mit `school_number`; UI-Gruppierung auf der Detailseite.
- Legacy **`audit_logs`:** optional; DELETE best-effort in **`app/api/documents/[id]/route.ts`**.

---

## 15. E2E (Playwright)

- Konfiguration **`playwright.config.ts`**, Tests z. B. **`e2e/smoke.spec.ts`** (Smoke Login/Dashboard/Dokumente/Detail; optional Upload — je nach Stand der Specs).

---

## 16. Relevante Migrations-Überblicke (kumulativ)

Multi-Tenant & RLS: **`20260320_multitenant_phase1.sql`**, **`20260320_multitenant_rls.sql`**

App-User Multi-School & `current_school_number()` JWT: **`20260410_app_users_email_school_unique_and_rls.sql`**

Archiv & KI-Cleanup: **`20260407_documents_archive_ai_queries_cleanup.sql`**

Workflow-Status Beschluss: **`20260406_document_status_enum_beschluss.sql`**

DSGVO & Löschanfragen: **`20260420_dsgvo_privacy_and_delete_requests.sql`**, Workflow **`20260422_delete_requests_workflow_and_user_active.sql`**

Feature-Flags Schulen: **`20260423_school_feature_flags.sql`**

RLS Nachzug schools / audit_logs / account_delete_requests: **`20260426120000_rls_schools_audit_logs_account_delete_requests.sql`**

Schulentwicklung Felder: **`20260503120000_documents_schulentwicklung_fields.sql`**

(Vollständige Liste: Verzeichnis **`supabase/migrations/`**.)
