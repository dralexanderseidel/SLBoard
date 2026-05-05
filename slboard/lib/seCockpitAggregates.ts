import {
  SCHULENTWICKLUNG_FIELDS,
  type SchulentwicklungField,
  parseSteeringAnalysisV2,
  type SteeringAnalysis,
} from './steeringAnalysisV2';

const STEERING_DIMS = ['tragfaehigkeit', 'entscheidungslogik', 'verbindlichkeit'] as const;
export type SteeringDimKey = (typeof STEERING_DIMS)[number];

export type SeCockpitHeatmapCell = {
  /** Mittelwert 0–100 oder null, wenn keine Zuordnung */
  avg: number | null;
  count: number;
};

/** Einzelne Matrix-Zelle (Aufgabenfeld × Steuerungsdimension) mit aggregiertem Mittelwert. */
export type SeCockpitMatrixCellHighlight = {
  field: SchulentwicklungField;
  dimension: SteeringDimKey;
  avg: number;
  count: number;
};

/** Ein Dokument in der Vorschau „berücksichtigt bei Aufgabenfeld …“. */
export type SeCockpitFieldDocPreview = {
  id: string;
  title: string;
  tragfaehigkeit: number;
  entscheidungslogik: number;
  verbindlichkeit: number;
};

export type SeCockpitFieldDocBucket = {
  /** Alle zugeordneten Dokumente mit gültiger Analyse */
  total: number;
  /** Top 5 nach Gesamtscore der Analyse (absteigend) */
  items: SeCockpitFieldDocPreview[];
};

export type SeCockpitPayload = {
  documentCount: number;
  /** Schulweiter Mittelwert je Steuerungsdimension (alle gültigen Analysen) */
  schoolWide: Record<SteeringDimKey, number | null>;
  heatmap: Record<SchulentwicklungField, Record<SteeringDimKey, SeCockpitHeatmapCell>>;
  /** Die drei Matrix-Zellen mit höchstem Mittelwert */
  strongestCells: SeCockpitMatrixCellHighlight[];
  /** Die drei Matrix-Zellen mit niedrigstem Mittelwert */
  weakestCells: SeCockpitMatrixCellHighlight[];
  /** Pro Aufgabenfeld: bis zu 5 Dokumente (sortiert nach Gesamtscore), plus Gesamtzahl */
  fieldDocumentPreviews: Record<SchulentwicklungField, SeCockpitFieldDocBucket>;
};

function assignedFieldsForAnalysis(a: SteeringAnalysis): SchulentwicklungField[] {
  const set = new Set<SchulentwicklungField>();
  const p = a.classification.primary_field;
  if (p) set.add(p);
  for (const s of a.classification.secondary_fields) {
    if (SCHULENTWICKLUNG_FIELDS.includes(s as SchulentwicklungField)) {
      set.add(s as SchulentwicklungField);
    }
  }
  return [...set];
}

function emptyHeatmap(): SeCockpitPayload['heatmap'] {
  const heatmap = {} as SeCockpitPayload['heatmap'];
  for (const f of SCHULENTWICKLUNG_FIELDS) {
    heatmap[f] = {
      tragfaehigkeit: { avg: null, count: 0 },
      entscheidungslogik: { avg: null, count: 0 },
      verbindlichkeit: { avg: null, count: 0 },
    };
  }
  return heatmap;
}

function emptyFieldDocBuckets(): SeCockpitPayload['fieldDocumentPreviews'] {
  const o = {} as SeCockpitPayload['fieldDocumentPreviews'];
  for (const f of SCHULENTWICKLUNG_FIELDS) {
    o[f] = { total: 0, items: [] };
  }
  return o;
}

type DocAggRow = { id: string; title?: string | null; steering_analysis: unknown };

type DocAggScratch = {
  id: string;
  title: string;
  tragfaehigkeit: number;
  entscheidungslogik: number;
  verbindlichkeit: number;
  overallScore: number;
};

/**
 * Aggregiert Steuerungsanalysen für das Steuerungs-Cockpit (nur gültiges V2-JSON pro Dokument).
 */
export function buildSeCockpitPayload(rows: DocAggRow[]): SeCockpitPayload {
  const heatmap = emptyHeatmap();
  const fieldBuckets: Record<SchulentwicklungField, DocAggScratch[]> = {
    unterrichtsentwicklung: [],
    personalentwicklung: [],
    organisationsentwicklung: [],
    qualitaetsentwicklung: [],
    strategie: [],
    kooperation: [],
    fuehrung_governance: [],
  };
  const schoolSums: Record<SteeringDimKey, number> = {
    tragfaehigkeit: 0,
    entscheidungslogik: 0,
    verbindlichkeit: 0,
  };
  let docCount = 0;

  for (const row of rows) {
    const parsed = parseSteeringAnalysisV2(row.steering_analysis, row.id);
    if (!parsed.ok) continue;
    const a = parsed.value;
    docCount += 1;

    const t = a.scores.tragfaehigkeit.total;
    const e = a.scores.entscheidungslogik.total;
    const v = a.scores.verbindlichkeit.total;
    schoolSums.tragfaehigkeit += t;
    schoolSums.entscheidungslogik += e;
    schoolSums.verbindlichkeit += v;

    const title = (row.title ?? '').trim() || 'Unbenannt';
    const scratch: DocAggScratch = {
      id: row.id,
      title,
      tragfaehigkeit: t,
      entscheidungslogik: e,
      verbindlichkeit: v,
      overallScore: a.overall.score,
    };

    const fields = assignedFieldsForAnalysis(a);
    for (const f of fields) {
      fieldBuckets[f].push(scratch);
      for (const dim of STEERING_DIMS as readonly SteeringDimKey[]) {
        const val = dim === 'tragfaehigkeit' ? t : dim === 'entscheidungslogik' ? e : v;
        const cell = heatmap[f][dim];
        const n = cell.count + 1;
        const prevSum = cell.avg == null ? 0 : cell.avg * cell.count;
        cell.count = n;
        cell.avg = (prevSum + val) / n;
      }
    }
  }

  const schoolWide: SeCockpitPayload['schoolWide'] = {
    tragfaehigkeit: docCount ? schoolSums.tragfaehigkeit / docCount : null,
    entscheidungslogik: docCount ? schoolSums.entscheidungslogik / docCount : null,
    verbindlichkeit: docCount ? schoolSums.verbindlichkeit / docCount : null,
  };

  const allCells: SeCockpitMatrixCellHighlight[] = [];
  for (const f of SCHULENTWICKLUNG_FIELDS) {
    for (const d of STEERING_DIMS) {
      const c = heatmap[f][d];
      if (c.count > 0 && c.avg != null) {
        allCells.push({ field: f, dimension: d, avg: c.avg, count: c.count });
      }
    }
  }

  const cmpCellRef = (a: SeCockpitMatrixCellHighlight, b: SeCockpitMatrixCellHighlight) =>
    a.field.localeCompare(b.field) || a.dimension.localeCompare(b.dimension);

  const strongestCells = [...allCells]
    .sort((a, b) => (b.avg !== a.avg ? b.avg - a.avg : cmpCellRef(a, b)))
    .slice(0, 3);

  const weakestCells = [...allCells]
    .sort((a, b) => (a.avg !== b.avg ? a.avg - b.avg : cmpCellRef(a, b)))
    .slice(0, 3);

  const fieldDocumentPreviews = emptyFieldDocBuckets();
  for (const f of SCHULENTWICKLUNG_FIELDS) {
    const arr = fieldBuckets[f];
    const sorted = [...arr].sort((a, b) => {
      if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
      return a.title.localeCompare(b.title, 'de');
    });
    const items: SeCockpitFieldDocPreview[] = sorted.slice(0, 5).map((d) => ({
      id: d.id,
      title: d.title,
      tragfaehigkeit: d.tragfaehigkeit,
      entscheidungslogik: d.entscheidungslogik,
      verbindlichkeit: d.verbindlichkeit,
    }));
    fieldDocumentPreviews[f] = { total: sorted.length, items };
  }

  return {
    documentCount: docCount,
    schoolWide,
    heatmap,
    strongestCells,
    weakestCells,
    fieldDocumentPreviews,
  };
}
