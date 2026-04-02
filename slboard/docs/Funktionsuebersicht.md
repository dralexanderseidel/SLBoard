# NOMOS EduGovernance Pro – Funktionsübersicht

Detaillierte Beschreibung der bisherigen Funktionsweise der Anwendung (Stand: Projektfortschritt).

---

## 1. Technologie und Architektur

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes (Server-seitig)
- **Datenbank & Auth:** Supabase (PostgreSQL, Auth, Storage)
- **KI:** LLM-Anbindung über Umgebungsvariablen (z. B. OpenAI-kompatible API); Aufrufe in `lib/llmClient.ts`
- **Text-Extraktion:** PDF (pdf-parse), Word (mammoth) in `lib/documentText.ts`

Die App läuft als klassische Web-App: Nutzer melden sich an, arbeiten im Browser; alle API-Aufrufe laufen über die gleiche Domain (kein separates Backend).

---

## 2. Authentifizierung

- **Supabase Auth:** Login/Logout über E-Mail/Passwort (oder konfigurierte Auth-Provider).
- **Seiten:** `/login` für Anmeldung; geschützte Bereiche prüfen die Session (API nutzt `createServerSupabaseClient()` und `getUser()`).
- **Nutzerverwaltung in der App:** Zusätzlich zu Supabase Auth gibt es die App-Tabellen `app_users` und `user_roles`. Die E-Mail aus Auth sollte mit `app_users.email` übereinstimmen – sie steuert Berechtigungen und Anzeige (z. B. UserMenu).

Ohne Login können viele APIs mit 401 antworten; die UI leitet ggf. zur Anmeldung.

---

## 3. Navigation und Seiten

| Route | Beschreibung |
|-------|--------------|
| **/** | Dashboard: KI-Suche (Zwei-Schritt: Dokumente vorschlagen → auswählen → beantworten), „Neu veröffentlicht“, „Aktuelle Anfragen“, Links zu Upload/Entwurf/Dokumenten |
| **/documents** | Dokumentenliste mit Filter (Typ, Status, Schutzklasse, Volltextsuche); Zugriff gefiltert nach Organisationseinheit/Rolle |
| **/documents/[id]** | Dokumentdetail: Metadaten, Versionen-Historie, Vorschau/Download, Workflow (Freigeben/Veröffentlichen), Bearbeiten, Rechtsbezug, KI-Zusammenfassung, „Entwurf erstellen“, neue Version hochladen, Löschen, Änderungsverlauf |
| **/upload** | Einzelnes Dokument hochladen (PDF/Word): Titel, Typ, Datum, Status, Schutzklasse, Gremium, Organisationseinheit |
| **/drafts** | Entwurfsassistent: Betreff, Zielgruppe, Kontext, Entwurfstext; KI-Vorschlag für Elternbrief; Quellen auswählen; „Entwurf als Dokument speichern“ (mit erster Version als .txt) |
| **/admin** | Nutzerverwaltung: `app_users` anzeigen/anlegen/bearbeiten, Rollen in `user_roles` zuweisen (nur für Nutzer mit Rolle SCHULLEITUNG oder ADMIN) |
| **/login** | Anmeldeseite |
| **/supabase-test** | Einfacher Verbindungstest zur Supabase-Datenbank (optional) |

Gemeinsamer Header mit NOMOS-Logo, Links (Dashboard, Dokumente, Entwurfsassistent, Admin) und UserMenu.

---

## 4. Dokumentenmodell und Workflow

### 4.1 Dokument (documents)

- **Kernfelder:** id, title, document_type_code, created_at, status, protection_class_id, responsible_unit, gremium, participation_groups, reach_scope, legal_reference, summary, current_version_id (und ggf. created_by_id, responsible_person_id).
- **Metadaten-Anzeige in der UI:** „Verantwortlich“ (= responsible_unit), „Beschlussgremium“ (= gremium), „Beteiligung“ (= participation_groups), „Reichweite“ (= reach_scope: intern|extern).
- **Dokumenttypen:** werden mandantenspezifisch (pro Schule) gepflegt; Standardwerte werden initial befüllt (siehe Admin/Metadaten).
- **Status-Workflow (nur diese Übergänge):**
  - **ENTWURF** → **FREIGEGEBEN** (Button „Freigeben“)
  - **FREIGEGEBEN** → **VEROEFFENTLICHT** (Button „Veröffentlichen“)
  - **VEROEFFENTLICHT:** Endstatus, keine weiteren Statusänderungen.
- Status wird nur über die Workflow-Buttons geändert, nicht mehr per freiem Dropdown.

### 4.2 Versionen (document_versions)

- Pro Dokument mehrere Versionen (version_number, created_at, comment, file_uri, mime_type, is_published).
- **Versionen-Historie:** Alle Versionen werden geladen (`GET /api/documents/[id]/versions`); Nutzer kann eine Version wählen, Vorschau/Download bezieht sich auf diese Version (`GET /api/documents/[id]/file?versionId=...`).
- **Neue Version:** Hochladen einer neuen Datei (PDF/Word) über Dokumentdetailseite; Version wird im Storage abgelegt und in `document_versions` eingetragen; `documents.current_version_id` wird aktualisiert.

### 4.3 Speicherung von Dateien

- Supabase Storage, Bucket `documents`; Pfadformat enthält `school_number` (Multi-Tenant).
- Zugriff nur über signierte URLs; Berechtigung anhand `app_users`/`user_roles` und `documents.responsible_unit` (Policy „documents_select_by_unit“).

---

## 5. Berechtigungen und Zugriffsfilter

- **Schutzklassenmodell (`protection_class_id`):**
  - **1:** Öffentlich (alle angemeldeten Lehrkräfte/Nutzer)
  - **2:** Nur Verwaltung/Sekretariat + Schulleitung
  - **3:** Nur Schulleitung
- **Dokumentenliste (GET /api/documents):** serverseitige Filterung nach Schutzklasse/Rolle.
- **Dokumentdetail, Datei, Versionen, Audit:** Zugriff ebenfalls nach Schutzklasse/Rolle.
- **Bearbeiten/Löschen/Neue Version:** zusätzlich organisationsbezogen (`responsible_unit` / `org_unit`) und rollenbasiert.
- **Admin:** Nur Nutzer mit Rolle **SCHULLEITUNG** oder **ADMIN** (`lib/adminAuth.ts`).
- **Storage:** Policies nutzen `app_users` und `user_roles`, um Lesezugriff auf Dateien nur für berechtigte Nutzer zu erlauben.

Details und Tabellendefinitionen: `docs/Berechtigungen-und-Zugriff.md`.

---

## 6. API-Routen (Überblick)

### 6.1 Dokumente

| Methode | Route | Funktion |
|---------|--------|----------|
| GET | `/api/documents` | Liste mit Filter (type, responsibleUnit, status, protectionClass, search); Berechtigung nach org_unit/Rolle; **Volltextsuche** in title, document_type_code, gremium, **summary**, **legal_reference**, **search_text** |
| PATCH | `/api/documents/[id]` | Metadaten/Status aktualisieren (inkl. Beteiligung/Reichweite); **Workflow-Validierung** (nur erlaubte Statusübergänge); **Audit-Eintrag** (document.update) |
| DELETE | `/api/documents/[id]` | Dokument löschen inkl. alle Versionen und zugehörige Storage-Dateien |
| GET | `/api/documents/[id]/file` | Signierte URL für aktuelle oder angegebene Version (`?versionId=`) |
| GET | `/api/documents/[id]/versions` | Alle Versionen des Dokuments (id, version_number, created_at, comment, mime_type, is_current) |
| POST | `/api/documents/[id]/version` | Neue Version hochladen (PDF/Word); **Audit-Eintrag** (version.upload) |
| GET | `/api/documents/[id]/audit` | Änderungsverlauf (audit_log) für dieses Dokument |
| GET | `/api/documents/[id]/extract-text` | Diagnose: Text-Extraktion aus der aktuellen Version prüfen (hasText, textLength, optional debug) |
| POST | `/api/documents/[id]/steering-analysis` | KI-Aktion „Analyse des Steuerungsbedarfs“ (mit Cache pro Dokument) |

### 6.2 Upload und Entwurf

| Methode | Route | Funktion |
|---------|--------|----------|
| POST | `/api/upload` | Neues Dokument mit hochgeladener Datei anlegen (Titel, Typ, Datum, Status, Beteiligung, Reichweite, etc.) |
| POST | `/api/drafts/save` | **Entwurf als echtes Dokument:** Dokument anlegen, Entwurfstext als erste Version (.txt) im Storage, `current_version_id` setzen; Rückgabe documentId |

### 6.3 KI

| Methode | Route | Funktion |
|---------|--------|----------|
| POST | `/api/ai/suggest-documents` | Zu einer Frage **relevante Dokumente vorschlagen** (Keyword-Suche, Relevanz-Score); **kein LLM**; Rückgabe suggestedDocuments (id, title, snippet, score) |
| POST | `/api/ai/query` | **KI-Antwort** auf Frage: optional **documentIds**; wenn angegeben, nur diese Dokumente als Kontext, sonst automatisch Vorschlagsliste (getSuggestedDocuments) → Kontext aus summary/Volltext/legal_reference → LLM; Rückgabe answer + sources |
| POST | `/api/ai/drafts/parent-letter` | KI-Vorschlag für Elternbrief-Entwurf (Thema, Zielgruppe, Quellen-Dokumente); nutzt freigegebene/veröffentlichte Dokumente |
| POST | `/api/summarize` | KI-Zusammenfassung für ein Dokument (documentId oder text/title/type); speichert Ergebnis in `documents.summary` |
| POST | `/api/summarize-batch` | Batch-Zusammenfassung für mehrere Dokumente; optionales Debug-Logging |

### 6.4 Metadaten, Benachrichtigungen und Admin

| Methode | Route | Funktion |
|---------|--------|----------|
| GET | `/api/metadata/options` | Tenant-spezifische Optionen für Auswahlfelder (Dokumenttypen, Verantwortlich) |
| GET/PUT | `/api/admin/metadata` | Metadaten-Optionen pro Schule pflegen (Admin-only) |
| GET/PUT | `/api/admin/ai-settings` | KI-Konfiguration pro Schule (Admin-only) inkl. Schul-Steckbrief |
| POST | `/api/admin/reindex` | Search-Index für Dokumente neu erzeugen (Admin-only) |
| GET | `/api/notifications/recently-published` | Kürzlich veröffentlichte Dokumente (aus audit_log: Statuswechsel auf VEROEFFENTLICHT); gefiltert nach Berechtigung |
| GET | `/api/admin/users` | Liste app_users mit Rollen (nur Admin) |
| POST | `/api/admin/users` | Nutzer anlegen (nur Admin) |
| PATCH | `/api/admin/users/[id]` | Nutzer bearbeiten (nur Admin) |
| PATCH | `/api/admin/users/[id]/roles` | Rollen setzen (nur Admin) |

---

## 7. KI-Funktionen im Detail

### 7.1 Dashboard-KI-Suche (Zwei-Schritt)

1. **Schritt 1 – Relevante Dokumente finden:**  
   Nutzer gibt Frage ein → Klick „Relevante Dokumente finden“ → **POST /api/ai/suggest-documents** (Keyword-Extraktion, Suche in title, legal_reference, responsible_unit, document_type_code, gremium, summary; Relevanz-Sortierung) → Anzeige einer Liste mit Checkboxen (alle vorausgewählt) und Kurzsnippet.

2. **Schritt 2 – Frage beantworten:**  
   Nutzer wählt Dokumente (Checkboxen) → Klick „Frage mit ausgewählten Dokumenten beantworten“ → **POST /api/ai/query** mit `question` und `documentIds` → Kontext nur aus gewählten Dokumenten (summary → Volltext aus Datei → legal_reference), dann LLM → Anzeige Antwort + verwendete Quellen.

- **„Ohne Auswahl direkt beantworten“:** Ruft dieselbe Query-API **ohne** documentIds auf; Server wählt automatisch die Top-Dokumente und antwortet (Verhalten wie frühere Ein-Schritt-Suche).

### 7.2 Kontextbildung für die KI (query/summarize)

Pro Dokument wird Text in dieser Priorität verwendet:  
1. **summary** (wenn vorhanden und ausreichend lang),  
2. sonst **Volltext** aus Storage-Datei (PDF/Word über getDocumentText),  
3. sonst **legal_reference**.  
Text wird pro Dokument auf MAX_TEXT_PER_DOC Zeichen begrenzt.

Für lange Dokumente wird zusätzlich **Chunking-on-the-fly** eingesetzt, um relevanten Kontext auszuwählen.

### 7.3 Entwurfsassistent

- Nutzer gibt Betreff, Zielgruppe, Kontext ein und wählt optional Quellen (freigegebene/veröffentlichte Dokumente).
- **KI-Vorschlag:** POST /api/ai/drafts/parent-letter erzeugt einen Entwurfstext auf Basis von Thema und Quelleninhalten.
- **Speichern:** POST /api/drafts/save legt ein neues Dokument (Typ ELTERNBRIEF, Status ENTWURF) an und speichert den Entwurfstext als **erste Version** (.txt) im Storage; Link „Dokument öffnen“ führt zur neuen Dokumentdetailseite.

### 7.4 KI-Zusammenfassung auf der Dokumentdetailseite

- Button „Zusammenfassung erzeugen“ → **POST /api/summarize** (documentId, ggf. Titel/Typ/Datum); Text aus Datei oder Metadaten → LLM erzeugt Kurzfassung → wird in `documents.summary` gespeichert und angezeigt.
- summary wird für die Dashboard-KI-Suche und für bessere Kontextqualität genutzt.

---

## 8. Audit-Log

- **Tabelle:** `audit_log` (id, user_email, action, entity_type, entity_id, old_values, new_values, created_at).
- **Einträge werden erzeugt bei:**
  - **document.update:** PATCH Dokument (Metadaten/Status); old_values/new_values enthalten geänderte Felder.
  - **version.upload:** Hochladen einer neuen Version; new_values enthält version_id, version_number, comment.
- **Anzeige:** Auf der Dokumentdetailseite Block „Änderungsverlauf“ (Datumszeit, E-Mail, Aktion, ggf. geänderte Felder).
- **Nutzen:** „Neu veröffentlicht“-Liste auf dem Dashboard nutzt Einträge mit action document.update und Statuswechsel auf VEROEFFENTLICHT.

---

## 9. Datenbank und Migrationen (Supabase)

- **documents:** Kern-Tabelle für Dokumente (inkl. summary, legal_reference, current_version_id).
- **document_versions:** Versionen mit file_uri, mime_type, version_number, comment.
- **app_users:** Nutzer mit email, org_unit (für Zugriffsfilter).
- **user_roles:** user_id, role_code (SCHULLEITUNG, SEKRETARIAT, LEHRKRAFT, etc.).
- **audit_log:** Änderungsprotokoll (s. o.).
- **ai_queries:** Optional gespeicherte KI-Anfragen (question, answer_excerpt, used_document_ids) für „Aktuelle Anfragen“ auf dem Dashboard.
- **ai_settings:** KI-Konfiguration pro Schule.
- **school_document_type_options / school_responsible_unit_options:** Metadaten-Optionen pro Schule.

Migrationen in `supabase/migrations/`:
- app_users und user_roles
- document summary (Spalte summary)
- legal_reference als Text
- Storage-Policies (Zugriff nach responsible_unit)
- audit_log
- Multi-Tenant (schools + school_number + RLS)
- Search-Index-Felder (search_text/keywords)
- Beteiligung (participation_groups) und Reichweite (reach_scope)
- Metadaten-Optionen pro Schule (Dokumenttypen/Verantwortlich)

Storage: Bucket `documents` für Dokumentdateien; Zugriff über signierte URLs und Berechtigungsprüfung.

---

## 10. UI-Besonderheiten

- **Rechtsbezug** in der Dokumentdetailseite: In der Leseansicht nach drei Zeilen mit „[…]“ abgekürzt; vollständig im Bearbeiten-Modus und im Entwurfstext-Block (wenn keine Dateivorschau).
- **Versionen:** Links in der Dokumentdetailseite Liste „Versionen“ mit Auswahl; gewählte Version bestimmt Vorschau und Download-Link.
- **Hintergrund:** Heller Grauton (z. B. bg-zinc-100) hinter den weißen Inhaltsboxen für bessere Abgrenzung.
- **NOMOS-Logo** in der Topzeile (nomos-logo-crop.png), verlinkt zur Startseite.
- **Admin-Bereich:** verwaltet Benutzer/Rollen, KI-Konfiguration und Metadatenlisten pro Schule.

---

## 11. Abhängigkeiten (Umgebung)

- **Supabase:** URL, anon key, service role key (für Server-seitige DB/Storage-Zugriffe).
- **LLM:** Konfiguration über Umgebungsvariablen (z. B. API-URL, Key) für KI-Anfragen, Zusammenfassung und Entwurfsvorschläge.

Ohne LLM-Konfiguration schlagen die entsprechenden API-Aufrufe mit einer Fehlermeldung fehl; Dokumentenverwaltung und Berechtigungen funktionieren unabhängig davon.
