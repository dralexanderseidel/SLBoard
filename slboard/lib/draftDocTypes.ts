/**
 * Konfiguration der unterstützten Dokumenttypen im Entwurfsassistenten.
 * Wird sowohl client-seitig (Seite) als auch server-seitig (API) verwendet.
 */

export type DraftDocTypeConfig = {
  code: string;
  label: string;
  /** Standard-Zielgruppe, vorbelegt im Formular */
  defaultAudience: string;
  /** Beschreibt den gewünschten Schreibstil für den LLM-System-Prompt */
  tone: string;
  /** Fachliche Rolle des LLM-Assistenten */
  systemRole: string;
  /** Formatanweisung im Nutzer-Prompt */
  formatInstructions: string;
  /** Placeholder-Text für das Betreff-Feld */
  subjectPlaceholder: string;
  /** Placeholder-Text für das Kontextfeld */
  contextPlaceholder: string;
  /** Placeholder-Text für das Entwurfstext-Feld */
  bodyPlaceholder: string;
};

export const DRAFT_DOC_TYPES: DraftDocTypeConfig[] = [
  {
    code: 'ELTERNBRIEF',
    label: 'Elternbrief',
    defaultAudience: 'Eltern der Schulgemeinschaft',
    tone: 'sachlichem, freundlichem',
    systemRole: 'Elternbriefe',
    formatInstructions: 'Mit Anrede und Grußformel.',
    subjectPlaceholder: 'z. B. Hinweis zur Handynutzung / Ablauf der Medienwoche',
    contextPlaceholder: 'z. B. Anlass, Ziel, Rahmenbedingungen, gewünschter Ton, konkrete Regeln/Termine.',
    bodyPlaceholder: 'Anrede,\n\nkurzer Einstieg (Anlass).\n\nKernpunkte / Regelungen / Termine.\n\nRückfragen / Kontakt.\n\nGrußformel',
  },
  {
    code: 'RUNDSCHREIBEN',
    label: 'Rundschreiben',
    defaultAudience: 'Kollegium',
    tone: 'klarem, informierendem',
    systemRole: 'Rundschreiben und interne Mitteilungen',
    formatInstructions: 'Gliedere in: Betreff, Anlass, wichtigste Informationen, ggf. Handlungsaufforderung, Absender.',
    subjectPlaceholder: 'z. B. Änderungen im Vertretungsplan / Dienstbesprechung am …',
    contextPlaceholder: 'z. B. Anlass, wichtigste Punkte, gewünschte Reaktion.',
    bodyPlaceholder: 'Anlass / Inhalt:\n\nWichtige Informationen:\n\nHandlungsaufforderung (falls nötig):\n\nAbsender',
  },
  {
    code: 'KONZEPT',
    label: 'Konzept',
    defaultAudience: 'Schulleitung und Kollegium',
    tone: 'strukturiertem, sachlichem',
    systemRole: 'Schulkonzepte und pädagogische Leitdokumente',
    formatInstructions: 'Gliedere in: 1. Ausgangslage · 2. Ziele · 3. Maßnahmen · 4. Evaluation · 5. Verantwortlichkeiten. Verwende Überschriften.',
    subjectPlaceholder: 'z. B. Medienkonzept / Inklusionskonzept / Leseförderprogramm',
    contextPlaceholder: 'z. B. Ausgangslage, beteiligte Gremien, Zeitrahmen, spezifische Schwerpunkte.',
    bodyPlaceholder: '1. Ausgangslage\n\n2. Ziele\n\n3. Maßnahmen\n\n4. Evaluation\n\n5. Verantwortlichkeiten',
  },
  {
    code: 'PROTOKOLL',
    label: 'Protokoll',
    defaultAudience: 'Teilnehmende des Gremiums',
    tone: 'sachlichem, neutralem',
    systemRole: 'Schulprotokolle und Sitzungsberichte',
    formatInstructions: 'Protokollformat: Datum, Teilnehmende, Tagesordnungspunkte (TOP 1, TOP 2, …), Beschlüsse, Nächste Schritte.',
    subjectPlaceholder: 'z. B. Protokoll Schulkonferenz / Protokoll Fachkonferenz Deutsch',
    contextPlaceholder: 'z. B. Datum, Sitzungsort, Tagesordnung, besondere Beschlüsse.',
    bodyPlaceholder: 'Datum: \nOrt: \nTeilnehmende: \n\nTOP 1:\n\nTOP 2:\n\nBeschlüsse:\n\nNächste Schritte:',
  },
  {
    code: 'BESCHLUSSVORLAGE',
    label: 'Beschlussvorlage',
    defaultAudience: 'Schulkonferenz',
    tone: 'sachlichem, verbindlichem',
    systemRole: 'Beschlussvorlagen für Schulgremien',
    formatInstructions: 'Struktur: Betreff, Sachverhalt/Begründung, Beschlussvorschlag, Abstimmungsverfahren.',
    subjectPlaceholder: 'z. B. Änderung der Schulordnung / Einführung Schülerzeitung',
    contextPlaceholder: 'z. B. Sachverhalt, rechtliche Grundlage, Begründung, gewünschtes Abstimmungsergebnis.',
    bodyPlaceholder: 'Sachverhalt / Begründung:\n\nBeschlussvorschlag:\n\nAbstimmung:\n\nDatum / Unterschriften:',
  },
  {
    code: 'CURRICULUM',
    label: 'Curriculum',
    defaultAudience: 'Fachkonferenz',
    tone: 'präzisem, fachlichem',
    systemRole: 'schulische Curricula und Fachcurricula',
    formatInstructions: 'Struktur: Fach/Jahrgang, Kompetenzen/Lernziele, Inhalte, Methoden, Leistungsbewertung, Materialien.',
    subjectPlaceholder: 'z. B. Fachcurriculum Biologie Klasse 9 / Mediencurriculum Sek. I',
    contextPlaceholder: 'z. B. Fach, Jahrgangsstufe, Stundenzahl, curriculare Vorgaben, Schwerpunkte.',
    bodyPlaceholder: 'Fach / Jahrgang:\n\nKompetenzen / Lernziele:\n\nInhalte:\n\nMethoden:\n\nLeistungsbewertung:\n\nMaterialien:',
  },
  {
    code: 'VEREINBARUNG',
    label: 'Vereinbarung',
    defaultAudience: 'Beteiligte Parteien',
    tone: 'verbindlichem, klarem',
    systemRole: 'Schulvereinbarungen und Regelwerke',
    formatInstructions: 'Struktur: Parteien, Gegenstand, Regelungen (nummeriert), Gültigkeit, Unterschriften.',
    subjectPlaceholder: 'z. B. Mediennutzungsvereinbarung / Hausordnung / Kooperationsvereinbarung',
    contextPlaceholder: 'z. B. beteiligte Parteien, Gegenstand, wichtigste Regeln, Gültigkeitszeitraum.',
    bodyPlaceholder: 'Zwischen:\n\nGegenstand:\n\n§ 1 ...\n§ 2 ...\n\nGültigkeit:\n\nUnterschriften:',
  },
  {
    code: 'SITUATIVE_REGELUNG',
    label: 'Situative Regelung',
    defaultAudience: 'Schulgemeinschaft',
    tone: 'klarem, direktem',
    systemRole: 'schulische Regelungen und Verhaltensvereinbarungen',
    formatInstructions: 'Kompakt und klar: Anlass, Regelung, Geltungsbereich, Inkrafttreten.',
    subjectPlaceholder: 'z. B. Nutzungsregel Computerraum / Pausenregelung Schulhof',
    contextPlaceholder: 'z. B. Anlass, betroffene Gruppen, spezifische Regeln, Geltungsdauer.',
    bodyPlaceholder: 'Anlass:\n\nRegelung:\n\nGeltungsbereich:\n\nInkrafttreten:',
  },
];

export function getDraftDocTypeConfig(code: string): DraftDocTypeConfig {
  return DRAFT_DOC_TYPES.find((t) => t.code === code) ?? DRAFT_DOC_TYPES[0];
}

/** Alle gültigen Typ-Codes */
export const DRAFT_DOC_TYPE_CODES = new Set(DRAFT_DOC_TYPES.map((t) => t.code));
