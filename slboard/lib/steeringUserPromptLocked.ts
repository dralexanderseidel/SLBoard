/**
 * Gesperrter User-Prompt Steuerungsanalyse (SE-Cockpit / Matrix + Scoring).
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

WICHTIG:
- Bewerte ausschließlich auf Basis expliziter Informationen im Dokument.
- Keine Annahmen oder Interpretationen.
- Fehlende Regelungen führen zu Punktabzug (bis 0).

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
    "scoring_principle": "Scores bewerten den Grad expliziter struktureller Klärung im Dokument.",
    "missing_information_policy": "Nicht belegte Regelungen werden nicht angenommen und führen zu Punktabzug.",
    "confidence": "hoch | mittel | niedrig",
    "confidence_reason": "string"
  }
}
`;
