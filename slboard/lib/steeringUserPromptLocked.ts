/**
 * Gesperrter User-Prompt Steuerungsanalyse (Schulentwicklungs-Cockpit / Matrix + Scoring).
 * Platzhalter: document_id, analysis_date, document_status_json, document_title,
 * document_metadata_block, school_profile_block, document_text
 */
export const STEERING_USER_LOCKED_TEMPLATE = `Pflichtwerte für die JSON-Wurzel (exakt übernehmen):
- document_id: "{{document_id}}"
- analysis_date: "{{analysis_date}}"
- document_status: "{{document_status_json}}"  (ein erlaubter Wert laut Schema unten)

---

Analysiere das folgende Dokument entlang der Schulentwicklungs-Matrix.

Vorgehen:

1. Ordne das Dokument primär einem oder mehreren Aufgabenfeldern zu.
   (Mehrfachzuordnung möglich, aber begründen)

2. Analysiere für jedes relevante Aufgabenfeld die drei Steuerungsdimensionen:

   a) Tragfähigkeit
   - Welche Anforderungen stellt das Dokument an die Organisation?
   - Sind Ressourcen, Zeit oder Kompetenzen implizit oder explizit erkennbar?

   b) Entscheidungslogik
   - Ist klar geregelt, wer entscheidet?
   - Ist Beteiligung von Entscheidung unterschieden?

   c) Verbindlichkeit
   - Sind Regelungen klar, stabil und verpflichtend formuliert?
   - Oder eher offen / unverbindlich?

3. Bewerte jede Dimension mit:
   - Stark / Mittel / Schwach
   (mit kurzer Begründung)

4. Identifiziere strukturelle Risiken:
   - Überforderung (geringe Tragfähigkeit)
   - Unklare Steuerung (fehlende Entscheidungslogik)
   - Unverbindlichkeit

5. Gib konkrete Verbesserungsvorschläge:
   - Nur strukturell (keine inhaltlichen Vorschläge!)
   - Fokus auf Steuerbarkeit


Bewerte das Dokument anhand eines strukturierten Scoring-Systems (0–100 Punkte pro Dimension).

WICHTIG (Belegbasis):
- Primär an expliziten Formulierungen im Dokumenttext sowie an belegbaren Angaben aus Metadaten und Schulprofil orientieren.
- Keine freien Inhaltserfindungen; keine Spekulation über nicht genannte Fakten außerhalb des Dokuments.
- Wo eine Regelung im Text fehlt, aber aus dem vorliegenden Wortlaut oder Kontext plausibel impliziert ist (z. B. übliche Gremienlogik, Rollen ohne Widerspruch zum übrigen Text): nicht pauschal mit 0 bewerten, sondern für das betreffende Kriterium differenziert niedrig vergeben (Orientierung etwa 5–15 Punkte) und kurz begründen („implizit“, „nicht ausdrücklich geregelt“).
- Wo etwas weder belegt noch plausibel impliziert ist: klarer Punktabzug bis hin zu sehr niedrigen Werten; nur klar defizitäre oder widersprüchliche Ausprägungen sollten Gesamtdimensionen unter 50 ziehen.

Kalibriere deine Bewertung so, dass:
- durchschnittliche schulische Konzepte im Bereich 60–75 liegen
- gut strukturierte Dokumente über 75 liegen
- nur klar defizitäre Dokumente unter 50 liegen

Bewerte fehlende Informationen nicht automatisch mit 0,
sondern differenziert (5–15 Punkte), wenn sie plausibel impliziert sind.

Vermeide eine Konzentration der Scores im Bereich 45–65.

---

Dimension 1: Tragfähigkeit (0–100)

Bewerte folgende 4 Kriterien (je 0–25 Punkte):

1. Ressourcen:
Sind Zeit, Personal oder Mittel explizit benannt?

2. Anschlussfähigkeit:
Ist erkennbar, wie das Vorhaben in bestehende Strukturen integriert wird?

3. Umsetzungs-Komplexität:
Ist die Umsetzung klar, konkret und überschaubar beschrieben?

4. Implizite Belastung:
Werden zusätzliche Belastungen vermieden oder reflektiert?

Gib für jedes Kriterium:
- Punkte (0–25)
- kurze Begründung

---

Dimension 2: Entscheidungslogik (0–100)

1. Zuständigkeit:
Ist klar benannt, wer entscheidet?

2. Entscheidung vs. Beteiligung:
Ist unterschieden, wer beteiligt ist und wer entscheidet?

3. Entscheidungszeitpunkt:
Ist geregelt, wann Entscheidungen getroffen werden?

4. Eskalationslogik:
Ist geregelt, was bei Konflikten oder Unklarheiten passiert?

---

Dimension 3: Verbindlichkeit (0–100)

1. Sprachliche Verbindlichkeit:
Werden klare, verpflichtende Formulierungen verwendet?

2. Geltungsbereich:
Ist klar, für wen die Regelungen gelten?

3. Regelmäßigkeit:
Sind Zeiträume oder Zyklen definiert?

4. Konsequenzen:
Sind Folgen oder Reaktionen bei Nicht-Einhaltung erkennbar?

---

Berechne:
- Score pro Dimension
- Gesamtbewertung (Mittelwert)

---

Zusätzlich:

1. Nenne die schwächste Dimension
2. Benenne die größte strukturelle Lücke in einem Satz
3. Gib einen präzisen Verbesserungsvorschlag

---

Evidenz-Logik:
- klar strukturiert
- keine langen Texte
- keine pädagogischen Bewertungen
- Fehlende Belege explizit benennen und konservativ bewerten.
- Keine freien Erfindungen: nur Schul-Steckbrief, Metadatenblock und Dokumenttext als Belegbasis.
- Praezise, kurze Begruendungen.

Dokumenttitel: {{document_title}}

{{document_metadata_block}}

{{school_profile_block}}Dokumenttext:
{{document_text}}

Antwortformat (MUSS exakt als JSON-Objekt eingehalten werden):
{
  "document_id": "string",
  "document_title": "string",
  "analysis_date": "YYYY-MM-DD",
  "document_status": "entwurf | freigegeben | gültig | außer_kraft | unbekannt",

  "classification": {
    "primary_field": "unterrichtsentwicklung | personalentwicklung | organisationsentwicklung | qualitaetsentwicklung | strategie | kooperation | fuehrung_governance",
    "secondary_fields": [
      "string"
    ],
    "classification_reason": "string"
  },

  "scores": {
    "tragfaehigkeit": {
      "total": 0,
      "rating": "kritisch | instabil | robust",
      "criteria": {
        "ressourcen": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        },
        "anschlussfaehigkeit": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        },
        "umsetzungskomplexitaet": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        },
        "implizite_belastung": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        }
      }
    },

    "entscheidungslogik": {
      "total": 0,
      "rating": "kritisch | instabil | robust",
      "criteria": {
        "zustaendigkeit": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        },
        "entscheidung_vs_beteiligung": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        },
        "entscheidungszeitpunkt": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        },
        "eskalationslogik": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        }
      }
    },

    "verbindlichkeit": {
      "total": 0,
      "rating": "kritisch | instabil | robust",
      "criteria": {
        "sprachliche_verbindlichkeit": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        },
        "geltungsbereich": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        },
        "regelmaessigkeit": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        },
        "konsequenzen": {
          "score": 0,
          "evidence": "string",
          "reason": "string"
        }
      }
    }
  },

  "overall": {
    "score": 0,
    "rating": "kritisch | instabil | robust",
    "weakest_dimension": "tragfaehigkeit | entscheidungslogik | verbindlichkeit",
    "main_structural_gap": "string",
    "summary": "string"
  },

  "risks": [
    {
      "type": "ueberforderung | unklare_entscheidung | unverbindlichkeit | widerspruch | fehlende_ressource",
      "severity": "niedrig | mittel | hoch | kritisch",
      "description": "string",
      "affected_dimension": "tragfaehigkeit | entscheidungslogik | verbindlichkeit",
      "evidence": "string"
    }
  ],

  "recommendations": [
    {
      "priority": "hoch | mittel | niedrig",
      "dimension": "tragfaehigkeit | entscheidungslogik | verbindlichkeit",
      "recommendation": "string",
      "expected_effect": "string"
    }
  ],

  "explainability": {
    "scoring_principle": "Scores bewerten strukturelle Klärung; Kalibrierung: typisch 60–75 für durchschnittliche schulische Konzepte, >75 für gut strukturierte, <50 nur bei klaren Defiziten; Scores nicht in 45–65 zusammendrücken.",
    "missing_information_policy": "Fehlendes Explizites führt zu Abzug; plausibel Impliziertes differenziert niedrig (z. B. 5–15 pro Kriterium), nicht automatisch 0.",
    "confidence": "hoch | mittel | niedrig",
    "confidence_reason": "string"
  }
}
`;
