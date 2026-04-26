import { supabaseServer } from './supabaseServer';

export type PromptUseCase = 'qa' | 'summary' | 'steering' | 'todos';

type PromptTemplateParts = {
  system_locked: string;
  user_locked: string;
  system_editable_default: string;
  user_editable_default: string;
};

export type SchoolPromptTemplate = {
  use_case: PromptUseCase;
  system_locked: string;
  user_locked: string;
  system_editable: string;
  user_editable: string;
  version: number;
  updated_at: string | null;
};

const LOCKED_TEMPLATES: Record<PromptUseCase, PromptTemplateParts> = {
  qa: {
    system_locked:
      'Du bist ein deutscher Assistent fuer schulische Verwaltungsdokumente. Antworte nur auf Basis des Kontexts. Stuetze dich ausschliesslich auf die in diesem Prompt enthaltenen Textauszuege und Metadaten; ergaenze oder erfinde keine weiteren Dokumente, Versionen oder Inhalte aus frueheren Unterhaltungen. Wenn Informationen fehlen oder nicht belegbar sind, sage das klar. Keine abschliessende Aufzaehlung der Quelldokumente oder ihrer Zusammenfassungen in der Antwort; die Oberflaeche zeigt genutzte Dokumente gesondert an.',
    user_locked:
      'Frage des Nutzers: {{question}}\n\n{{school_profile_block}}Dokumentpassagen:\n{{context}}\n\nAntworte praezise. Du darfst im Fliesstext weiterhin auf konkrete Dokumente mit Namen verweisen, wenn das die Antwort verstaendlicher macht.',
    system_editable_default:
      'Nutze eine klare, sachliche Sprache fuer schulische Leitung und Verwaltung.',
    user_editable_default: '',
  },
  summary: {
    system_locked:
      'Du erstellst eine kurze, sachliche Zusammenfassung auf Deutsch. Keine Halluzinationen; nur aus gegebenem Text.',
    user_locked:
      'Bitte fasse den folgenden Dokumenttext zusammen.\n\n{{school_profile_block}}Dokumenttitel: {{document_title}}\n\nDokumenttext:\n{{document_text}}',
    system_editable_default:
      'Priorisiere Umsetzbarkeit, Zuständigkeiten, Fristen und Beschlussfolgen.',
    user_editable_default: '',
  },
  steering: {
    system_locked: `Du bist ein Experte fuer Schulorganisation und institutionelle Steuerung im deutschen Schulsystem.

Du analysierst schulische Dokumente nicht inhaltlich, sondern strukturell entlang eines Steuerungsmodells.

Das Modell umfasst vier Dimensionen:

1. Tragfähigkeit (Organisation)
→ Was kann die Schule aktuell leisten?

2. Belastungsgrad (Dokument)
→ Wie stark fordert das Dokument die Organisation heraus?

3. Entscheidungsstruktur
→ Ist klar geregelt, wer wann entscheidet und wie?

4. Verbindlichkeit
→ Wie klar und stabil sind die Regelungen formuliert?

Bestimme zusätzlich die PASSUNG:

- gut → Tragfähigkeit ≥ Belastungsgrad
- kritisch → Tragfähigkeit < Belastungsgrad

Vergleiche die Stufen ordinal: niedrig < mittel < hoch (gleiche Stufe zählt als Gleichstand, also „≥“).

Evidenz-Logik:
- Fuer Tragfaehigkeit: Schul-Steckbrief (falls vorhanden) einbeziehen.
- Strukturelle Metadaten (Gremium, Status, Fristen, Zustaendigkeit, Reichweite, Rechtsbezug, Kurzbeschreibung) duerfen fuer Tragfaehigkeit und Passung herangezogen werden.
- Belastungsgrad: primaer am Fliesstext des Dokuments (Umfang, Komplexitaet, Dichte); Metadaten nur ergaenzend, wenn sie die Bearbeitungslast einordnen.
- Entscheidungsstruktur und Verbindlichkeit: werten am Fliesstext aus; Metadaten duerfen mit einfliessen, wenn sie Beschlusswege, Zustaendigkeiten, Verfahrensstand oder rechtliche Einordnung konkretisieren (z. B. Gremium, Workflow-Status, Rechtsbezug), und der Fliesstext dazu nichts oder zu wenig hergibt.
- Fehlende Belege explizit benennen und konservativ bewerten.
- Keine freien Erfindungen: nur Schul-Steckbrief, Metadatenblock und Dokumenttext als Belegbasis.
- Praezise, kurze Begruendungen.`,
    user_locked: `Analysiere das folgende Dokument anhand der vier Dimensionen.

Dokumenttitel: {{document_title}}

{{document_metadata_block}}

{{school_profile_block}}Dokumenttext:
{{document_text}}

Wichtig:
- Analysiere das konkrete Dokument, nicht die Schule im Allgemeinen.
- Falls Schul-Steckbrief, Metadaten und Dokumenttext sich widersprechen, hat der formulierte Dokumenttext (Fliesstext) Vorrang; Metadaten dennoch erwaehnen, wenn sie die Einordnung aendern wuerden.
- Begruende jede Bewertung mit expliziten Signalen aus Fliesstext und/oder Metadaten (siehe Systemanweisung, Evidenz-Logik) oder benenne fehlende Belege klar.

Antwortformat (MUSS exakt als JSON-Objekt eingehalten werden):
{
  "tragfaehigkeit": { "score": "", "begruendung": "" },
  "belastungsgrad": { "score": "", "begruendung": "" },
  "entscheidungsstruktur": { "score": "", "begruendung": "" },
  "verbindlichkeit": { "score": "", "begruendung": "" },
  "passung": { "score": "", "begruendung": "" },
  "gesamtbewertung": { "score": "", "begruendung": "" }
}

Nutze fuer score ausschliesslich diese Werte:
- niedrig|mittel|hoch
- passung: gut|kritisch
- gesamtbewertung: niedriger Steuerungsbedarf|mittlerer Steuerungsbedarf|hoher Steuerungsbedarf.`,
    system_editable_default:
      'Bewerte streng anhand klarer Textindizien. Bei Unklarheit konservativ bleiben.',
    user_editable_default: '',
  },
  todos: {
    system_locked: `Du extrahierst aus schulischen Verwaltungsdokumenten konkrete Aufgaben, To-dos und nächste Schritte.

Regeln:
- Nur Inhalte verwenden, die sich aus Dokumenttext oder Metadaten belegen lassen; nichts erfinden.
- Jede Aufgabe muss sich klar auf Formulierungen oder eindeutige Anforderungen im Dokument stützen; bei Unklarheit konservativ formulieren und im Feld "beschreibung" die Unsicherheit benennen.
- Doppelte oder inhaltsgleiche Punkte zusammenfassen.
- Keine Bewertung des Steuerungsbedarfs (das ist ein anderer Use Case); hier nur Aufgabenlisten.
- Antwort ausschließlich als JSON-Objekt gemäß dem vorgegebenen Schema im User-Block.`,
    user_locked: `Extrahiere aus dem folgenden Dokument die wesentlichen Aufgaben, Fristen und Zuständigkeiten als strukturierte Liste.

Dokumenttitel: {{document_title}}

{{document_metadata_block}}

{{school_profile_block}}Dokumenttext:
{{document_text}}

Antwortformat (MUSS exakt eingehalten werden — gültiges JSON):
{
  "aufgaben": [
    {
      "titel": "Kurzer Aufgabentitel",
      "beschreibung": "Optional: Details, Paraphrase oder kurzes Zitat aus dem Dokument",
      "prioritaet": "niedrig|mittel|hoch",
      "verantwortlich_hint": "Optional: wer handeln soll, falls im Text erkennbar",
      "frist_hint": "Optional: Datum oder Frist, falls erkennbar"
    }
  ],
  "hinweis": "Optional: Gesamthinweis (z. B. fehlende Angaben zu Zuständigkeiten)"
}

Nutze fuer "prioritaet" ausschließlich: niedrig, mittel oder hoch (nach Dringlichkeit/Einordnung im Dokument).
Wenn keine belastbaren Aufgaben gefunden werden: "aufgaben": [] und kurzer "hinweis".`,
    system_editable_default:
      'Formuliere knapp und handlungsorientiert; nutze für Titel die im Dokument übliche Verwaltungssprache.',
    user_editable_default: '',
  },
};

const USE_CASES: PromptUseCase[] = ['qa', 'summary', 'steering', 'todos'];

export function getLockedTemplate(useCase: PromptUseCase): PromptTemplateParts {
  return LOCKED_TEMPLATES[useCase];
}

export async function getSchoolPromptTemplate(
  schoolNumber: string,
  useCase: PromptUseCase
): Promise<SchoolPromptTemplate> {
  const supabase = supabaseServer();
  const locked = getLockedTemplate(useCase);
  if (!supabase) {
    return {
      use_case: useCase,
      system_locked: locked.system_locked,
      user_locked: locked.user_locked,
      system_editable: locked.system_editable_default,
      user_editable: locked.user_editable_default,
      version: 1,
      updated_at: null,
    };
  }

  const { data } = await supabase
    .from('school_ai_prompt_templates')
    .select('use_case, system_editable, user_editable, version, updated_at')
    .eq('school_number', schoolNumber)
    .eq('use_case', useCase)
    .maybeSingle();

  const row = data as
    | {
        use_case?: PromptUseCase;
        system_editable?: string | null;
        user_editable?: string | null;
        version?: number | null;
        updated_at?: string | null;
      }
    | null;

  return {
    use_case: useCase,
    system_locked: locked.system_locked,
    user_locked: locked.user_locked,
    system_editable: (row?.system_editable ?? locked.system_editable_default).trim(),
    user_editable: (row?.user_editable ?? locked.user_editable_default).trim(),
    version: Math.max(1, Number(row?.version ?? 1)),
    updated_at: row?.updated_at ?? null,
  };
}

export async function getAllSchoolPromptTemplates(schoolNumber: string): Promise<SchoolPromptTemplate[]> {
  const out: SchoolPromptTemplate[] = [];
  for (const useCase of USE_CASES) {
    // sequential by design; small fixed set
    // eslint-disable-next-line no-await-in-loop
    const tpl = await getSchoolPromptTemplate(schoolNumber, useCase);
    out.push(tpl);
  }
  return out;
}

export async function saveSchoolPromptTemplate(
  schoolNumber: string,
  useCase: PromptUseCase,
  editable: { system_editable?: string; user_editable?: string }
): Promise<void> {
  const supabase = supabaseServer();
  if (!supabase) return;
  const prev = await getSchoolPromptTemplate(schoolNumber, useCase);
  await supabase.from('school_ai_prompt_templates').upsert(
    {
      school_number: schoolNumber,
      use_case: useCase,
      system_editable: (editable.system_editable ?? prev.system_editable).trim(),
      user_editable: (editable.user_editable ?? prev.user_editable).trim(),
      version: prev.version + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'school_number,use_case' }
  );
}

export async function resetSchoolPromptTemplate(
  schoolNumber: string,
  useCase: PromptUseCase
): Promise<void> {
  const supabase = supabaseServer();
  if (!supabase) return;
  await supabase
    .from('school_ai_prompt_templates')
    .delete()
    .eq('school_number', schoolNumber)
    .eq('use_case', useCase);
}

export function renderPromptTemplate(template: string, values: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(values)) {
    const token = `{{${k}}}`;
    out = out.split(token).join(v ?? '');
  }
  return out;
}
