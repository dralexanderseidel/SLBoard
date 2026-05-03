/**
 * Steuerungsanalyse SE-Cockpit: Schulentwicklungs-Matrix + Scoring (0–100).
 * JSON-Schema gemäß Produktvorgabe; Validierung für API und Admin-Prompt-Preview.
 */

export const SCHULENTWICKLUNG_FIELDS = [
  'unterrichtsentwicklung',
  'personalentwicklung',
  'organisationsentwicklung',
  'qualitaetsentwicklung',
  'strategie',
  'kooperation',
  'fuehrung_governance',
] as const;

export type SchulentwicklungField = (typeof SCHULENTWICKLUNG_FIELDS)[number];

export const STEERING_DOCUMENT_STATUS_JSON = [
  'entwurf',
  'freigegeben',
  'gültig',
  'außer_kraft',
  'unbekannt',
] as const;

export type SteeringDocumentStatusJson = (typeof STEERING_DOCUMENT_STATUS_JSON)[number];

export type SteeringDimensionRating = 'kritisch' | 'instabil' | 'robust';

export type SteeringCriterionScore = {
  score: number;
  evidence: string;
  reason: string;
};

export type SteeringDimensionBlock = {
  total: number;
  rating: SteeringDimensionRating;
  criteria: Record<string, SteeringCriterionScore>;
};

export type SteeringClassification = {
  primary_field: SchulentwicklungField;
  secondary_fields: string[];
  classification_reason: string;
};

export type SteeringRisk = {
  type:
    | 'ueberforderung'
    | 'unklare_entscheidung'
    | 'unverbindlichkeit'
    | 'widerspruch'
    | 'fehlende_ressource';
  severity: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
  description: string;
  affected_dimension: 'tragfaehigkeit' | 'entscheidungslogik' | 'verbindlichkeit';
  evidence: string;
};

export type SteeringRecommendation = {
  priority: 'hoch' | 'mittel' | 'niedrig';
  dimension: 'tragfaehigkeit' | 'entscheidungslogik' | 'verbindlichkeit';
  recommendation: string;
  expected_effect: string;
};

export type SteeringExplainability = {
  scoring_principle: string;
  missing_information_policy: string;
  confidence: 'hoch' | 'mittel' | 'niedrig';
  confidence_reason: string;
};

export type SteeringAnalysis = {
  document_id: string;
  document_title: string;
  analysis_date: string;
  document_status: SteeringDocumentStatusJson;
  classification: SteeringClassification;
  scores: {
    tragfaehigkeit: SteeringDimensionBlock;
    entscheidungslogik: SteeringDimensionBlock;
    verbindlichkeit: SteeringDimensionBlock;
  };
  overall: {
    score: number;
    rating: SteeringDimensionRating;
    weakest_dimension: 'tragfaehigkeit' | 'entscheidungslogik' | 'verbindlichkeit';
    main_structural_gap: string;
    summary: string;
  };
  risks: SteeringRisk[];
  recommendations: SteeringRecommendation[];
  explainability: SteeringExplainability;
};

const DIMENSION_KEYS = ['tragfaehigkeit', 'entscheidungslogik', 'verbindlichkeit'] as const;

const TRAG_CRITERIA = ['ressourcen', 'anschlussfaehigkeit', 'umsetzungskomplexitaet', 'implizite_belastung'] as const;
const ENT_CRITERIA = [
  'zustaendigkeit',
  'entscheidung_vs_beteiligung',
  'entscheidungszeitpunkt',
  'eskalationslogik',
] as const;
const VER_CRITERIA = [
  'sprachliche_verbindlichkeit',
  'geltungsbereich',
  'regelmaessigkeit',
  'konsequenzen',
] as const;

function isSchulentwicklungField(s: string): s is SchulentwicklungField {
  return (SCHULENTWICKLUNG_FIELDS as readonly string[]).includes(s);
}

function isDocumentStatusJson(s: string): s is SteeringDocumentStatusJson {
  return (STEERING_DOCUMENT_STATUS_JSON as readonly string[]).includes(s);
}

function isDimensionRating(s: string): s is SteeringDimensionRating {
  return s === 'kritisch' || s === 'instabil' || s === 'robust';
}

function toInt0to25(v: unknown, path: string, errors: string[]): number | null {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : typeof v === 'string' ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 25) {
    errors.push(`${path}: Zahl 0–25 erwartet.`);
    return null;
  }
  return n;
}

function toInt0to100(v: unknown, path: string, errors: string[]): number | null {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : typeof v === 'string' ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    errors.push(`${path}: Zahl 0–100 erwartet.`);
    return null;
  }
  return n;
}

function asTrimmedString(v: unknown, path: string, errors: string[], allowEmpty = false): string | null {
  if (typeof v !== 'string') {
    errors.push(`${path}: String erwartet.`);
    return null;
  }
  const t = v.trim();
  if (!t && !allowEmpty) {
    errors.push(`${path}: Darf nicht leer sein.`);
    return null;
  }
  return t;
}

function parseCriteriaBlock(
  raw: unknown,
  path: string,
  keys: readonly string[],
  errors: string[]
): Record<string, SteeringCriterionScore> | null {
  if (!raw || typeof raw !== 'object') {
    errors.push(`${path}: Objekt erwartet.`);
    return null;
  }
  const o = raw as Record<string, unknown>;
  const out: Record<string, SteeringCriterionScore> = {};
  for (const k of keys) {
    const c = o[k];
    const cp = `${path}.${k}`;
    if (!c || typeof c !== 'object') {
      errors.push(`${cp}: Objekt erwartet.`);
      return null;
    }
    const co = c as Record<string, unknown>;
    const sc = toInt0to25(co.score, `${cp}.score`, errors);
    const ev = asTrimmedString(co.evidence, `${cp}.evidence`, errors, true) ?? '';
    const re = asTrimmedString(co.reason, `${cp}.reason`, errors, true) ?? '';
    if (sc === null) return null;
    out[k] = { score: sc, evidence: ev, reason: re };
  }
  return out;
}

function parseDimension(
  raw: unknown,
  path: string,
  keys: readonly string[],
  errors: string[]
): SteeringDimensionBlock | null {
  if (!raw || typeof raw !== 'object') {
    errors.push(`${path}: Objekt erwartet.`);
    return null;
  }
  const o = raw as Record<string, unknown>;
  const total = toInt0to100(o.total, `${path}.total`, errors);
  const ratingRaw = asTrimmedString(o.rating, `${path}.rating`, errors);
  if (total === null || !ratingRaw || !isDimensionRating(ratingRaw)) {
    if (ratingRaw && !isDimensionRating(ratingRaw)) {
      errors.push(`${path}.rating: kritisch|instabil|robust erwartet.`);
    }
    return null;
  }
  const criteria = parseCriteriaBlock(o.criteria, `${path}.criteria`, keys, errors);
  if (!criteria) return null;
  const sum = keys.reduce((s, k) => s + (criteria[k]?.score ?? 0), 0);
  if (Math.abs(sum - total) > 25) {
    errors.push(`${path}.total: Summe der Kriterien (${sum}) weicht sehr stark von total (${total}) ab (>25).`);
  }
  return { total, rating: ratingRaw, criteria };
}

export function mapDbStatusToSteeringDocumentStatus(
  db: string | null | undefined,
  archivedAt?: string | null
): SteeringDocumentStatusJson {
  if (archivedAt) return 'außer_kraft';
  const s = (db ?? '').trim().toUpperCase();
  if (s === 'ENTWURF') return 'entwurf';
  if (s === 'FREIGEGEBEN') return 'freigegeben';
  if (s === 'BESCHLUSS' || s === 'VEROEFFENTLICHT') return 'gültig';
  return 'unbekannt';
}

export function schulentwicklungFieldLabelDe(code: string): string {
  const map: Record<string, string> = {
    unterrichtsentwicklung: 'Unterrichtsentwicklung',
    personalentwicklung: 'Personalentwicklung',
    organisationsentwicklung: 'Organisationsentwicklung',
    qualitaetsentwicklung: 'Qualitätsentwicklung',
    strategie: 'Strategie',
    kooperation: 'Kooperation',
    fuehrung_governance: 'Führung & Governance',
  };
  return map[code] ?? code;
}

/** Anzeigenamen für JSON-Kriterienschlüssel (Steuerungsanalyse-UI). */
const STEERING_CRITERION_LABEL_DE: Record<string, string> = {
  ressourcen: 'Ressourcen',
  anschlussfaehigkeit: 'Anschlussfähigkeit',
  umsetzungskomplexitaet: 'Umsetzungskomplexität',
  implizite_belastung: 'Implizite Belastung',
  zustaendigkeit: 'Zuständigkeit',
  entscheidung_vs_beteiligung: 'Entscheidung vs. Beteiligung',
  entscheidungszeitpunkt: 'Entscheidungszeitpunkt',
  eskalationslogik: 'Eskalationslogik',
  sprachliche_verbindlichkeit: 'Sprachliche Verbindlichkeit',
  geltungsbereich: 'Geltungsbereich',
  regelmaessigkeit: 'Regelmäßigkeit',
  konsequenzen: 'Konsequenzen',
};

export function steeringCriterionLabelDe(key: string): string {
  const k = key.trim();
  if (STEERING_CRITERION_LABEL_DE[k]) return STEERING_CRITERION_LABEL_DE[k];
  return k
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const STEERING_DIMENSION_LABEL_DE: Record<string, string> = {
  tragfaehigkeit: 'Tragfähigkeit',
  entscheidungslogik: 'Entscheidungslogik',
  verbindlichkeit: 'Verbindlichkeit',
};

export function steeringDimensionLabelDe(key: string): string {
  const k = key.trim();
  return STEERING_DIMENSION_LABEL_DE[k] ?? steeringCriterionLabelDe(k);
}

const STEERING_RATING_LABEL_DE: Record<string, string> = {
  kritisch: 'Kritisch',
  instabil: 'Instabil',
  robust: 'Robust',
};

export function steeringRatingLabelDe(rating: string): string {
  return STEERING_RATING_LABEL_DE[rating] ?? rating;
}

const STEERING_RISK_TYPE_LABEL_DE: Record<string, string> = {
  ueberforderung: 'Überforderung',
  unklare_entscheidung: 'Unklare Entscheidung',
  unverbindlichkeit: 'Unverbindlichkeit',
  widerspruch: 'Widerspruch',
  fehlende_ressource: 'Fehlende Ressource',
};

export function steeringRiskTypeLabelDe(type: string): string {
  return STEERING_RISK_TYPE_LABEL_DE[type] ?? steeringCriterionLabelDe(type);
}

/** niedrig · mittel · hoch (Priorität, Modell-Konfidenz) sowie kritisch (Risiko-Schwere). */
const STEERING_LEVEL_LABEL_DE: Record<string, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
  kritisch: 'Kritisch',
};

export function steeringLevelLabelDe(v: string): string {
  return STEERING_LEVEL_LABEL_DE[v] ?? v;
}

export function buildSchulentwicklungDenorm(classification: SteeringClassification): {
  primary: string | null;
  fields: string[];
} {
  const primary = classification.primary_field?.trim() || null;
  const sec = Array.isArray(classification.secondary_fields)
    ? classification.secondary_fields.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const set = new Set<string>();
  if (primary) set.add(primary);
  for (const s of sec) set.add(s);
  return { primary, fields: [...set] };
}

/** Rating aus 0–100-Gesamtscore ( konservativ ). */
export function ratingFromNumericScore(total: number): SteeringDimensionRating {
  if (total >= 70) return 'robust';
  if (total >= 40) return 'instabil';
  return 'kritisch';
}

export function parseSteeringAnalysisV2(
  raw: unknown,
  expectedDocumentId: string
): { ok: true; value: SteeringAnalysis } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Kein JSON-Objekt.'] };
  }
  const o = raw as Record<string, unknown>;

  const document_id = asTrimmedString(o.document_id, 'document_id', errors);
  const document_title = asTrimmedString(o.document_title, 'document_title', errors);
  const analysis_date = asTrimmedString(o.analysis_date, 'analysis_date', errors);
  const document_status = asTrimmedString(o.document_status, 'document_status', errors);

  if (expectedDocumentId && document_id !== expectedDocumentId) {
    errors.push(`document_id muss exakt "${expectedDocumentId}" sein.`);
  }
  if (analysis_date && !/^\d{4}-\d{2}-\d{2}$/.test(analysis_date)) {
    errors.push('analysis_date: Format YYYY-MM-DD erwartet.');
  }
  if (document_status && !isDocumentStatusJson(document_status)) {
    errors.push(`document_status: ungültiger Wert.`);
  }

  const clRaw = o.classification;
  if (!clRaw || typeof clRaw !== 'object') {
    errors.push('classification: Objekt erwartet.');
  } else {
    const cl = clRaw as Record<string, unknown>;
    const pf = asTrimmedString(cl.primary_field, 'classification.primary_field', errors);
    if (!pf || !isSchulentwicklungField(pf)) {
      errors.push('classification.primary_field: gültiges Aufgabenfeld erforderlich.');
    }
    if (!Array.isArray(cl.secondary_fields)) {
      errors.push('classification.secondary_fields: Array erwartet.');
    } else {
      for (let i = 0; i < cl.secondary_fields.length; i++) {
        const sf = cl.secondary_fields[i];
        if (typeof sf !== 'string' || !sf.trim()) {
          errors.push(`classification.secondary_fields[${i}]: nicht-leerer String erwartet.`);
        }
      }
    }
    asTrimmedString(cl.classification_reason, 'classification.classification_reason', errors, true);
  }

  let tragBlock: SteeringDimensionBlock | null = null;
  let entBlock: SteeringDimensionBlock | null = null;
  let verBlock: SteeringDimensionBlock | null = null;

  const scoresRaw = o.scores;
  if (!scoresRaw || typeof scoresRaw !== 'object') {
    errors.push('scores: Objekt erwartet.');
  } else {
    const sr = scoresRaw as Record<string, unknown>;
    tragBlock = parseDimension(sr.tragfaehigkeit, 'scores.tragfaehigkeit', TRAG_CRITERIA, errors);
    entBlock = parseDimension(sr.entscheidungslogik, 'scores.entscheidungslogik', ENT_CRITERIA, errors);
    verBlock = parseDimension(sr.verbindlichkeit, 'scores.verbindlichkeit', VER_CRITERIA, errors);
  }

  const overallRaw = o.overall;
  if (!overallRaw || typeof overallRaw !== 'object') {
    errors.push('overall: Objekt erwartet.');
  } else {
    const ov = overallRaw as Record<string, unknown>;
    const os = toInt0to100(ov.score, 'overall.score', errors);
    const rt = asTrimmedString(ov.rating, 'overall.rating', errors);
    if (rt && !isDimensionRating(rt)) errors.push('overall.rating: ungültig.');
    const wd = asTrimmedString(ov.weakest_dimension, 'overall.weakest_dimension', errors);
    if (
      wd &&
      wd !== 'tragfaehigkeit' &&
      wd !== 'entscheidungslogik' &&
      wd !== 'verbindlichkeit'
    ) {
      errors.push('overall.weakest_dimension: ungültig.');
    }
    asTrimmedString(ov.main_structural_gap, 'overall.main_structural_gap', errors);
    asTrimmedString(ov.summary, 'overall.summary', errors);
    if (os !== null && rt && isDimensionRating(rt)) {
      const derived = ratingFromNumericScore(os);
      if (rt !== derived) {
        /* weich: nur Hinweis, nicht hart fehlschlagen */
      }
    }
  }

  if (!Array.isArray(o.risks)) {
    errors.push('risks: Array erwartet.');
  } else {
    const riskTypes = new Set([
      'ueberforderung',
      'unklare_entscheidung',
      'unverbindlichkeit',
      'widerspruch',
      'fehlende_ressource',
    ]);
    const sev = new Set(['niedrig', 'mittel', 'hoch', 'kritisch']);
    o.risks.forEach((r, i) => {
      if (!r || typeof r !== 'object') {
        errors.push(`risks[${i}]: Objekt erwartet.`);
        return;
      }
      const rr = r as Record<string, unknown>;
      const t = asTrimmedString(rr.type, `risks[${i}].type`, errors);
      if (t && !riskTypes.has(t)) errors.push(`risks[${i}].type: ungültig.`);
      const s = asTrimmedString(rr.severity, `risks[${i}].severity`, errors);
      if (s && !sev.has(s)) errors.push(`risks[${i}].severity: ungültig.`);
      asTrimmedString(rr.description, `risks[${i}].description`, errors);
      const ad = asTrimmedString(rr.affected_dimension, `risks[${i}].affected_dimension`, errors);
      if (ad && !DIMENSION_KEYS.includes(ad as (typeof DIMENSION_KEYS)[number])) {
        errors.push(`risks[${i}].affected_dimension: ungültig.`);
      }
      asTrimmedString(rr.evidence, `risks[${i}].evidence`, errors, true);
    });
  }

  if (!Array.isArray(o.recommendations)) {
    errors.push('recommendations: Array erwartet.');
  } else {
    const pri = new Set(['hoch', 'mittel', 'niedrig']);
    o.recommendations.forEach((r, i) => {
      if (!r || typeof r !== 'object') {
        errors.push(`recommendations[${i}]: Objekt erwartet.`);
        return;
      }
      const rr = r as Record<string, unknown>;
      const p = asTrimmedString(rr.priority, `recommendations[${i}].priority`, errors);
      if (p && !pri.has(p)) errors.push(`recommendations[${i}].priority: ungültig.`);
      const d = asTrimmedString(rr.dimension, `recommendations[${i}].dimension`, errors);
      if (d && !DIMENSION_KEYS.includes(d as (typeof DIMENSION_KEYS)[number])) {
        errors.push(`recommendations[${i}].dimension: ungültig.`);
      }
      asTrimmedString(rr.recommendation, `recommendations[${i}].recommendation`, errors);
      asTrimmedString(rr.expected_effect, `recommendations[${i}].expected_effect`, errors, true);
    });
  }

  const exRaw = o.explainability;
  if (!exRaw || typeof exRaw !== 'object') {
    errors.push('explainability: Objekt erwartet.');
  } else {
    const ex = exRaw as Record<string, unknown>;
    asTrimmedString(ex.scoring_principle, 'explainability.scoring_principle', errors);
    asTrimmedString(ex.missing_information_policy, 'explainability.missing_information_policy', errors);
    const conf = asTrimmedString(ex.confidence, 'explainability.confidence', errors);
    if (conf && conf !== 'hoch' && conf !== 'mittel' && conf !== 'niedrig') {
      errors.push('explainability.confidence: ungültig.');
    }
    asTrimmedString(ex.confidence_reason, 'explainability.confidence_reason', errors);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (!tragBlock || !entBlock || !verBlock) {
    return { ok: false, errors: ['Scores konnten nicht vollständig gelesen werden.'] };
  }

  const cl = o.classification as Record<string, unknown>;
  const classification: SteeringClassification = {
    primary_field: cl.primary_field as SchulentwicklungField,
    secondary_fields: Array.isArray(cl.secondary_fields)
      ? (cl.secondary_fields as unknown[]).map((x) => String(x).trim()).filter(Boolean)
      : [],
    classification_reason: String(cl.classification_reason ?? '').trim(),
  };

  const ov = o.overall as Record<string, unknown>;
  const overall = {
    score: Number(ov.score),
    rating: ov.rating as SteeringDimensionRating,
    weakest_dimension: ov.weakest_dimension as SteeringAnalysis['overall']['weakest_dimension'],
    main_structural_gap: String(ov.main_structural_gap ?? '').trim(),
    summary: String(ov.summary ?? '').trim(),
  };

  const risks = (o.risks as unknown[]).map((r) => {
    const rr = r as Record<string, unknown>;
    return {
      type: rr.type as SteeringRisk['type'],
      severity: rr.severity as SteeringRisk['severity'],
      description: String(rr.description ?? '').trim(),
      affected_dimension: rr.affected_dimension as SteeringRisk['affected_dimension'],
      evidence: String(rr.evidence ?? '').trim(),
    };
  });

  const recommendations = (o.recommendations as unknown[]).map((r) => {
    const rr = r as Record<string, unknown>;
    return {
      priority: rr.priority as SteeringRecommendation['priority'],
      dimension: rr.dimension as SteeringRecommendation['dimension'],
      recommendation: String(rr.recommendation ?? '').trim(),
      expected_effect: String(rr.expected_effect ?? '').trim(),
    };
  });

  const ex = o.explainability as Record<string, unknown>;
  const explainability: SteeringExplainability = {
    scoring_principle: String(ex.scoring_principle ?? '').trim(),
    missing_information_policy: String(ex.missing_information_policy ?? '').trim(),
    confidence: ex.confidence as SteeringExplainability['confidence'],
    confidence_reason: String(ex.confidence_reason ?? '').trim(),
  };

  const value: SteeringAnalysis = {
    document_id: document_id!,
    document_title: document_title!,
    analysis_date: analysis_date!,
    document_status: document_status as SteeringDocumentStatusJson,
    classification,
    scores: {
      tragfaehigkeit: tragBlock,
      entscheidungslogik: entBlock,
      verbindlichkeit: verBlock,
    },
    overall,
    risks,
    recommendations,
    explainability,
  };

  return { ok: true, value };
}

export function steeringListChipFromAnalysis(steering_analysis: unknown): {
  overallRating?: SteeringDimensionRating;
  legacyGesamt?: string;
} {
  if (!steering_analysis || typeof steering_analysis !== 'object') return {};
  const o = steering_analysis as Record<string, unknown>;
  const overall = o.overall as Record<string, unknown> | undefined;
  const r = overall?.rating;
  if (r === 'robust' || r === 'instabil' || r === 'kritisch') {
    return { overallRating: r };
  }
  const g = o.gesamtbewertung as Record<string, unknown> | undefined;
  const s = g?.score;
  if (typeof s === 'string') return { legacyGesamt: s };
  return {};
}

export const STEERING_V2_REPAIR_SCHEMA_SNIPPET = `{
  "document_id": "uuid",
  "document_title": "string",
  "analysis_date": "YYYY-MM-DD",
  "document_status": "entwurf|freigegeben|gültig|außer_kraft|unbekannt",
  "classification": { "primary_field": "unterrichtsentwicklung|...", "secondary_fields": ["..."], "classification_reason": "..." },
  "scores": {
    "tragfaehigkeit": { "total": 0-100, "rating": "kritisch|instabil|robust", "criteria": { "ressourcen": {"score":0-25,"evidence":"","reason":""}, ... } },
    "entscheidungslogik": { ... },
    "verbindlichkeit": { ... }
  },
  "overall": { "score": 0-100, "rating": "kritisch|instabil|robust", "weakest_dimension": "tragfaehigkeit|entscheidungslogik|verbindlichkeit", "main_structural_gap": "", "summary": "" },
  "risks": [ { "type": "...", "severity": "...", "description": "", "affected_dimension": "...", "evidence": "" } ],
  "recommendations": [ { "priority": "...", "dimension": "...", "recommendation": "", "expected_effect": "" } ],
  "explainability": { "scoring_principle": "", "missing_information_policy": "", "confidence": "hoch|mittel|niedrig", "confidence_reason": "" }
}`;
