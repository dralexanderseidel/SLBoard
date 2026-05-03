'use client';

import type { SteeringAnalysis, SteeringDimensionBlock } from '@/lib/steeringAnalysisV2';
import {
  schulentwicklungFieldLabelDe,
  steeringCriterionLabelDe,
  steeringDimensionLabelDe,
  steeringLevelLabelDe,
  steeringRatingLabelDe,
  steeringRiskTypeLabelDe,
} from '@/lib/steeringAnalysisV2';

function ratingDotClass(rating: string) {
  if (rating === 'robust') return 'bg-emerald-500';
  if (rating === 'instabil') return 'bg-amber-400';
  return 'bg-red-500';
}

function DimensionBlock({
  title,
  block,
}: {
  title: string;
  block: SteeringDimensionBlock;
}) {
  return (
    <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ratingDotClass(block.rating)}`} />
        <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">
          {title}: {block.total}/100 · {steeringRatingLabelDe(block.rating)}
        </span>
      </div>
      <ul className="mt-1 space-y-1.5 text-[10px] text-zinc-600 dark:text-zinc-300">
        {Object.entries(block.criteria).map(([key, c]) => (
          <li key={key}>
            <span className="font-medium text-zinc-700 dark:text-zinc-200">
              {steeringCriterionLabelDe(key)} ({c.score}/25)
            </span>
            {c.reason ? <span className="block text-zinc-500 dark:text-zinc-400">{c.reason}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SteeringAnalysisPanel({ analysis }: { analysis: SteeringAnalysis }) {
  const { classification, scores, overall, risks, recommendations, explainability } = analysis;

  return (
    <div className="mt-2 space-y-2 rounded border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">Steuerungsanalyse (Matrix & Scoring)</p>

      <div className="rounded border border-zinc-200 bg-white p-2 text-[11px] dark:border-zinc-700 dark:bg-zinc-950">
        <p className="font-semibold text-zinc-800 dark:text-zinc-100">Schulentwicklung</p>
        <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">
          Primär: <span className="font-medium">{schulentwicklungFieldLabelDe(classification.primary_field)}</span>
        </p>
        {classification.secondary_fields.length > 0 ? (
          <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">
            Weitere Felder:{' '}
            {classification.secondary_fields.map((f) => schulentwicklungFieldLabelDe(f)).join(', ')}
          </p>
        ) : null}
        {classification.classification_reason ? (
          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{classification.classification_reason}</p>
        ) : null}
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <DimensionBlock title="Tragfähigkeit" block={scores.tragfaehigkeit} />
        <DimensionBlock title="Entscheidungslogik" block={scores.entscheidungslogik} />
        <DimensionBlock title="Verbindlichkeit" block={scores.verbindlichkeit} />
      </div>

      <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${ratingDotClass(overall.rating)}`} />
          <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">
            Gesamt: {overall.score}/100 · {steeringRatingLabelDe(overall.rating)} · schwächste Dimension:{' '}
            {steeringDimensionLabelDe(overall.weakest_dimension)}
          </p>
        </div>
        {overall.main_structural_gap ? (
          <p className="mt-1 text-[10px] text-zinc-600 dark:text-zinc-300">{overall.main_structural_gap}</p>
        ) : null}
        {overall.summary ? <p className="mt-1 text-[10px] text-zinc-600 dark:text-zinc-300">{overall.summary}</p> : null}
      </div>

      {risks.length > 0 ? (
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950">
          <p className="mb-1 text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">Risiken</p>
          <ul className="space-y-1.5 text-[10px] text-zinc-600 dark:text-zinc-300">
            {risks.map((r, i) => (
              <li key={`${r.type}-${i}`}>
                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                  {steeringRiskTypeLabelDe(r.type)} ({steeringLevelLabelDe(r.severity)}) ·{' '}
                  {steeringDimensionLabelDe(r.affected_dimension)}
                </span>
                <span className="block">{r.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-950">
          <p className="mb-1 text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">Verbesserungsvorschläge</p>
          <ul className="space-y-1.5 text-[10px] text-zinc-600 dark:text-zinc-300">
            {recommendations.map((r, i) => (
              <li key={`${r.dimension}-${i}`}>
                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                  {steeringLevelLabelDe(r.priority)} · {steeringDimensionLabelDe(r.dimension)}
                </span>
                <span className="block">{r.recommendation}</span>
                {r.expected_effect ? <span className="block text-zinc-500">{r.expected_effect}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded border border-dashed border-zinc-300 p-2 text-[10px] text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
        <p className="font-medium text-zinc-600 dark:text-zinc-300">Nachvollziehbarkeit</p>
        <p className="mt-0.5">{explainability.scoring_principle}</p>
        <p className="mt-0.5">{explainability.missing_information_policy}</p>
        <p className="mt-0.5">
          Verlässlichkeit KI: {steeringLevelLabelDe(explainability.confidence)} — {explainability.confidence_reason}
        </p>
      </div>
    </div>
  );
}
