# log/os Edu Governance Pro – Implementierte Logik (Detail)

Stand: 2026-04-02

Diese Dokumentation ergänzt `docs/Funktionsuebersicht.md` um die wichtigsten Implementierungsdetails („wie genau funktioniert es?“) und verweist auf die relevanten Dateien/Routen.

---

## 1. Grundprinzipien

- Die App ist eine Next.js-App (App Router). UI und API-Routen liegen im selben Projekt.
- Supabase wird genutzt für:
  - Auth (Login/Session)
  - Postgres (Datenhaltung)
  - Storage (Dateien)
- Alle Kernfunktionen sind **mandantenfähig** über `school_number` (6-stellig) umgesetzt.
- API-Antworten verwenden ein **einheitliches Fehlerformat** über `lib/apiError.ts`.

---

## 2. Mandantenfähigkeit (Multi-Tenant)

### 2.1 Tenant-Key

- Tenant-Key ist `school_number` (char(6)).
- Zentrale Tabellen führen `school_number` (u. a. `documents`, `document_versions`, `audit_log`, `app_users`, `ai_queries`).

Relevante Migrationen:
- `supabase/migrations/20260320_multitenant_phase1.sql`
- `supabase/migrations/20260320_multitenant_rls.sql`

### 2.2 Tenant-Kontext im Code

- Tenant-Kontext wird serverseitig über `getUserAccessContext()` aus `app_users` geladen.
- Der Zugriff auf Daten wird zusätzlich über `canAccessSchool()` abgesichert.

Datei:
- `lib/documentAccess.ts`

### 2.3 RLS (Row Level Security)

- Es existieren RLS-Policies, die `school_number = public.current_school_number()` erzwingen.
- Wichtiger Hinweis: Service-Role umgeht RLS. Deshalb ist im Servercode weiterhin eine zusätzliche Prüfung sinnvoll (wird an vielen Stellen gemacht).

Datei:
- `supabase/migrations/20260320_multitenant_rls.sql`

---

## 3. Authentifizierung und Rollen

### 3.1 Auth

- Login erfolgt über Supabase Auth (E-Mail/Passwort).
- Viele API-Routen prüfen serverseitig `auth.getUser()` über `createServerSupabaseClient()`.

### 3.2 App-Nutzer und Rollen

- Zusätzlich zu Supabase Auth werden Nutzer in `app_users` geführt und Rollen in `user_roles`.
- Rollen steuern:
  - Admin-Funktionen
  - Schutzklassen-Zugriff
  - teilweise Bearbeitungsrechte (zusammen mit `org_unit`/`responsible_unit`)

Dateien:
- `supabase/migrations/20250309_app_users_and_roles.sql`
- `lib/documentAccess.ts`
- `lib/adminAuth.ts`

---

## 4. Dokumentmodell und Dateien

### 4.1 Tabellen

**documents**
- `title`
- `document_type_code`
- `status` (ENTWURF | FREIGEGEBEN | VEROEFFENTLICHT)
- `protection_class_id` (1..3)
- `responsible_unit` (Anzeige/Filter/Org-Bezug)
- `gremium` (Anzeige als „Beschlussgremium“)
- `participation_groups` (text[]; „Beteiligung“)
- `reach_scope` (intern|extern; „Reichweite“)
- `legal_reference`
- `summary`, `summary_updated_at`
- `review_date`
- `current_version_id`
- `steering_analysis*` Cache-Felder
- `search_text`, `keywords`, `indexed_at`

**document_versions**
- pro Dokument mehrere Versionen; in Storage liegt die Datei unter einem Pfad, der `school_number` enthält

Relevante Migrationen:
- `supabase/migrations/20260317_search_index_fields.sql`
- `supabase/migrations/20260318_summary_updated_at.sql`
- `supabase/migrations/20260319_review_date.sql`
- `supabase/migrations/20260330_documents_steering_analysis_cache.sql`
- `supabase/migrations/20260401_documents_participation_groups.sql`
- `supabase/migrations/20260402_documents_reichweite.sql`

### 4.2 Storage

- Bucket: `documents` (privat)
- Zugriff: signierte URLs (über API), plus Berechtigungsprüfung.

---

## 5. Workflow (Status)

### 5.1 Erlaubte Übergänge

- ENTWURF → FREIGEGEBEN
- FREIGEGEBEN → VEROEFFENTLICHT
- VEROEFFENTLICHT ist Endstatus

### 5.2 Validierung

- Serverseitig in `app/api/documents/[id]/route.ts` wird geprüft, ob der Statuswechsel erlaubt ist.
- Änderungen werden in `audit_log` protokolliert (best-effort).

---

## 6. Metadaten-UI und Pflege (pro Schule)

### 6.1 Metadatenfelder

Umbenennungen in der UI:
- „Organisationseinheit“ → „Verantwortlich“ (`documents.responsible_unit`)
- „Gremium“ → „Beschlussgremium“ (`documents.gremium`)

Neue Felder:
- „Beteiligung“ (`documents.participation_groups`, `text[]`)
- „Reichweite“ (`documents.reach_scope`, `intern|extern`)

### 6.2 Tenant-spezifische Auswahllisten (Typ & Verantwortlich)

Motivation:
- Die Optionen sollen pro Schule gepflegt werden können.

Tabellen:
- `public.school_document_type_options`
- `public.school_responsible_unit_options`

Migration:
- `supabase/migrations/20260402_school_metadata_options.sql`

APIs:
- `GET /api/metadata/options` liefert die aktiven Listen für die aktuelle Schule.
- `GET/PUT /api/admin/metadata` verwaltet die Listen (Admin-only, pro Schule).

UI:
- Upload lädt Optionen über `/api/metadata/options` und nutzt Fallbacks.
- Dokumentdetail-Bearbeiten lädt Optionen und erlaubt zusätzlich „Andere…“ bei Verantwortlich.
- Dokumentübersicht nutzt die tenant-spezifischen Filterlisten (Typ/Verantwortlich).
- Adminseite bietet „Metadaten pflegen“ (Dokumenttypen + Verantwortlich).

---

## 7. Suche und Indexing (Phase A)

### 7.1 Ziel

- KI-Aufrufe reduzieren und Dokumentauswahl für KI verbessern.
- Schnelle Suche über `search_text` + Metadaten.

### 7.2 Index-Build

- `lib/indexing.ts` erzeugt:
  - `keywords` (Frequenz-basierte Schlagwörter)
  - `search_text` (Titel + Metadaten + Keywords + Excerpt)

Index-Inputs beinhalten u. a.:
- Titel, Typ, Beschlussgremium, Verantwortlich, Beteiligung
- summary/legal_reference/extractedText als Textbasis

Index wird aktualisiert bei:
- Upload (`/api/upload`)
- neue Version (`/api/documents/[id]/version`)
- Reindex Admin (`/api/admin/reindex`)

---

## 8. KI-Funktionen (Chunking, Logging, Caching)

### 8.1 Chunking-on-the-fly

- Lange Texte werden absatzbasiert in Chunks gesplittet und relevanter Kontext ausgewählt.
- Parameter sind pro Schule konfigurierbar (`ai_settings`).

Dateien:
- `lib/chunkingOnTheFly.ts`
- `app/api/ai/query/route.ts`

### 8.2 KI-Zusammenfassung

- `POST /api/summarize` und `POST /api/summarize-batch`
- Ergebnis in `documents.summary` + `summary_updated_at`
- Debug-Logging optional

### 8.3 Analyse des Steuerungsbedarfs

- `POST /api/documents/[id]/steering-analysis`
- Ergebnis wird im Dokument gecached (`documents.steering_analysis*`)
- UI zeigt Ampeln und Gesamtbewertung.
- Prompt berücksichtigt Schul-Steckbrief (Tragfähigkeit), übrige Dimensionen dokumentbasiert.

### 8.4 Debug-Logging

- Debug-Log wird je nach Env/School-Setting geschrieben.
- Relevante Utility: `lib/aiQueryDebugLog.ts`

---

## 9. Vorschau (PDF/Word/Text)

- Signierte URL wird über `/api/documents/[id]/file` geladen (optional mit `versionId`).
- `text/plain` wird in der Detailseite als Textvorschau gerendert.

---

## 10. Audit-Log

- Änderungen werden in `audit_log` protokolliert (z. B. `document.update`, `version.upload`).
- Detailseite zeigt den Änderungsverlauf gruppiert.

Migration:
- `supabase/migrations/20250309_audit_log.sql`

---

## 11. E2E Smoke Tests (Playwright)

- Playwright ist eingerichtet (Smoke-Tests für Login/Dashboard/Dokumente/Detailseite; optional Upload).

Dateien:
- `playwright.config.ts`
- `e2e/smoke.spec.ts`

