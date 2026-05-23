/**
 * Steuerungsmatrix-orientierte Prompt-Ergänzungen für den Entwurfsassistenten.
 * Ausrichtung an steeringAnalysisV2 (Tragfähigkeit, Entscheidungslogik, Verbindlichkeit).
 */

/** Dokumenttypen, für die zusätzliche Governance- und Strukturhinweise gelten. */
export const STEERING_RELEVANT_DRAFT_DOC_TYPES = new Set([
  'KONZEPT',
  'BESCHLUSSVORLAGE',
  'VEREINBARUNG',
  'PROTOKOLL',
  'SITUATIVE_REGELUNG',
]);

export function isSteeringRelevantDraftDocType(typeCode: string): boolean {
  return STEERING_RELEVANT_DRAFT_DOC_TYPES.has(typeCode.trim().toUpperCase());
}

const DRAFT_STEERING_SELF_CHECK = `Prüfe den Entwurf vor der Ausgabe intern anhand der Steuerungsmatrix:
- Tragfähigkeit: Ressourcen und Organisation, Umsetzbarkeit, Anschluss an bestehende Strukturen
- Entscheidungslogik: klare Zuständigkeiten, Wer entscheidet wann, Abgrenzung Beteiligung vs. Beschluss, Eskalationswege
- Verbindlichkeit: verbindliche Formulierungen, Geltungsbereich, Fristen oder Rhythmus, Konsequenzen bei Nichteinhaltung

Behebe erkannte Lücken still; gib nur die verbesserte Endfassung im geforderten Format aus (keine Prüfkommentare).`;

const DRAFT_STEERING_GOVERNANCE_BOOST = `Priorisiere institutionelle Tragfähigkeit vor rein pädagogischer Rhetorik. Erstelle ein institutionell belastbares Steuerungsdokument mit Governance-Klarheit, expliziten Zuständigkeiten, operationalisierten Prozessen und überprüfbarer Verbindlichkeit — kein rein visionäres Konzeptpapier ohne Umsetzungsanker.`;

const DRAFT_STEERING_FORMAT_APPENDIX = `Strukturelle Mindestanforderungen (für spätere Steuerungsanalyse):
- Benenne Verantwortlichkeiten (Rolle und konkrete Aufgabe).
- Mache Entscheidungs- und Beschlusslogik nachvollziehbar.
- Setze Fristen, Geltungsbereich und ggf. Konsequenzen verbindlich.
- Verankere einen kurzen Evaluation-/Review-Hinweis (Was, wann, wer).`;

/** System-Prompt für POST /api/ai/drafts/document */
export function buildDraftAssistantSystemPrompt(
  typeSystemRole: string,
  typeTone: string,
  typeCode: string,
): string {
  const parts = [
    `Du bist ein deutscher Assistent für schulische ${typeSystemRole}.`,
    `Erstelle Entwürfe in ${typeTone} Ton, auf Deutsch.`,
    DRAFT_STEERING_SELF_CHECK,
  ];
  if (isSteeringRelevantDraftDocType(typeCode)) {
    parts.push(DRAFT_STEERING_GOVERNANCE_BOOST);
  }
  parts.push('Antworte NUR mit dem geforderten Format, ohne zusätzliche Erklärungen.');
  return parts.join('\n');
}

/** User-Prompt: formatInstructions inkl. Steuerungs-Mindestbausteine bei passenden Typen. */
export function buildDraftFormatInstructions(typeCode: string, baseHint: string): string {
  const base = baseHint.trim();
  if (!isSteeringRelevantDraftDocType(typeCode)) return base;
  return base ? `${base}\n\n${DRAFT_STEERING_FORMAT_APPENDIX}` : DRAFT_STEERING_FORMAT_APPENDIX;
}
