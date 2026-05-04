'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  SCHULENTWICKLUNG_FIELDS,
  ratingFromNumericScore,
  schulentwicklungFieldLabelDe,
  steeringDimensionLabelDe,
  steeringRatingLabelDe,
  type SchulentwicklungField,
} from '@/lib/steeringAnalysisV2';
import type { SeCockpitPayload, SteeringDimKey } from '@/lib/seCockpitAggregates';
import { readApiJsonOk } from '@/lib/readApiJson';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';
import { ApiErrorCallout } from '@/components/ApiErrorCallout';
import type { SerializedApiError } from '@/lib/apiUserError';
import { serializeApiError } from '@/lib/apiUserError';

type ApiSeCockpit = SeCockpitPayload & {
  ok: boolean;
  reason?: 'needs_school_context' | 'no_school';
};

function dotClassForAvg(avg: number | null): string {
  if (avg == null) return 'bg-zinc-300 dark:bg-zinc-600';
  const r = ratingFromNumericScore(avg);
  if (r === 'robust') return 'bg-emerald-500';
  if (r === 'instabil') return 'bg-amber-400';
  return 'bg-red-500';
}

function formatScore(v: number | null): string {
  if (v == null) return '—';
  return v.toFixed(1);
}

const DIMS: SteeringDimKey[] = ['tragfaehigkeit', 'entscheidungslogik', 'verbindlichkeit'];

function dimScoreCell(value: number) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClassForAvg(value)}`} />
      <span className="text-zinc-900 dark:text-zinc-50">{formatScore(value)}</span>
    </span>
  );
}

function FieldDocumentsTable({
  data,
  selectedField,
}: {
  data: ApiSeCockpit;
  selectedField: SchulentwicklungField;
}) {
  const bucket = data.fieldDocumentPreviews[selectedField];
  const moreHref = `/documents?auftragfeld=${encodeURIComponent(selectedField)}&steering=has`;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Dokumente: {schulentwicklungFieldLabelDe(selectedField)}
      </h2>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Dieselben Dokumente wie in der gewählten Matrix-Zeile; Bewertungen je Dokument (nicht Zeilenmittel).
        Aufgabenfeld über die Matrix-Zeile wählen.
      </p>

      {bucket.total === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Keine Dokumente mit gültiger Steuerungsanalyse und Zuordnung zu diesem Aufgabenfeld.
        </p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th className="border-b border-zinc-200 bg-zinc-50 px-2 py-2 font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200">
                    Dokument
                  </th>
                  {DIMS.map((d) => (
                    <th
                      key={d}
                      className="border-b border-zinc-200 bg-zinc-50 px-2 py-2 text-center font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200"
                    >
                      {steeringDimensionLabelDe(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bucket.items.map((doc) => (
                  <tr key={doc.id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                    <td className="max-w-[14rem] px-2 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {doc.title}
                      </Link>
                    </td>
                    {DIMS.map((dim) => (
                      <td key={dim} className="px-2 py-2 text-center tabular-nums">
                        {dimScoreCell(doc[dim])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bucket.total > 5 ? (
            <p className="mt-3 text-center text-sm">
              <Link href={moreHref} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
                Weitere in der Dokumentenliste ({bucket.total - bucket.items.length} weitere)
              </Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function SeCockpitPageClient() {
  const [data, setData] = useState<ApiSeCockpit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SerializedApiError | null>(null);
  const [selectedField, setSelectedField] = useState<SchulentwicklungField>(SCHULENTWICKLUNG_FIELDS[0]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/se-cockpit', { credentials: 'include', cache: 'no-store' });
      const json = await readApiJsonOk<ApiSeCockpit>(res, 'SE-Cockpit konnte nicht geladen werden.');
      setData(json);
    } catch (e) {
      setData(null);
      setError(serializeApiError(e, 'SE-Cockpit konnte nicht geladen werden.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.ok) return;
    setSelectedField((prev) => {
      if (data.fieldDocumentPreviews[prev].total > 0) return prev;
      return (
        SCHULENTWICKLUNG_FIELDS.find((f) => data.fieldDocumentPreviews[f].total > 0) ?? prev
      );
    });
  }, [data]);

  const hint =
    data?.ok === false
      ? data.reason === 'needs_school_context'
        ? 'Bitte Schul-Kontext wählen (gleiche E-Mail an mehreren Schulen).'
        : 'Für die Auswertung ist eine Schulzuordnung erforderlich.'
      : null;

  return (
    <div className={`${APP_PAGE_MAX_OUTER_CLASS} py-6`}>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            SE-Cockpit
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Auswertung aller nicht archivierten Dokumente mit gültiger Steuerungsanalyse (Matrix V2).
            Heatmap-Zellen: Mittelwert der Dimension nur über Dokumente, die dem jeweiligen
            Aufgabenfeld zugeordnet sind.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {loading ? 'Laden …' : 'Aktualisieren'}
        </button>
      </div>

      {error ? <ApiErrorCallout error={error} /> : null}
      {hint ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {hint}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-64 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ) : data && data.ok ? (
        <>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{data.documentCount}</span>{' '}
            {data.documentCount === 1 ? 'Dokument' : 'Dokumente'} mit auswertbarer Analyse.
          </p>

          <section className="mb-6 grid gap-3 sm:grid-cols-3">
            {DIMS.map((dim) => {
              const v = data.schoolWide[dim];
              const rating = v != null ? ratingFromNumericScore(v) : null;
              return (
                <div
                  key={dim}
                  className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {steeringDimensionLabelDe(dim)}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatScore(v)}
                    <span className="text-base font-normal text-zinc-500">/100</span>
                  </p>
                  {rating ? (
                    <p className="mt-1 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                      <span className={`inline-block h-2 w-2 rounded-full ${dotClassForAvg(v)}`} />
                      {steeringRatingLabelDe(rating)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_min(22rem,100%)]">
            <div className="min-w-0 space-y-6">
              <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Schulentwicklungs-Matrix
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Zeilen: Aufgabenfelder · Spalten: Steuerungsdimensionen · Mittelwerte 0–100 · Zeile anklicken,
                  um die Dokumenttabelle darunter zu filtern
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
                    <thead>
                      <tr>
                        <th className="border-b border-zinc-200 bg-zinc-50 px-2 py-2 font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200">
                          Aufgabenfeld
                        </th>
                        {DIMS.map((d) => (
                          <th
                            key={d}
                            className="border-b border-zinc-200 bg-zinc-50 px-2 py-2 text-center font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200"
                          >
                            {steeringDimensionLabelDe(d)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SCHULENTWICKLUNG_FIELDS.map((field) => (
                        <tr
                          key={field}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedField(field)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedField(field);
                            }
                          }}
                          className={`cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800/80 dark:hover:bg-zinc-900/50 ${
                            selectedField === field
                              ? 'bg-zinc-100 dark:bg-zinc-900/70'
                              : ''
                          }`}
                        >
                          <td className="max-w-[10rem] px-2 py-2 font-medium text-zinc-800 dark:text-zinc-100">
                            <span className="text-blue-700 underline decoration-blue-700/30 underline-offset-2 hover:decoration-blue-700 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:decoration-blue-400">
                              {schulentwicklungFieldLabelDe(field)}
                            </span>
                          </td>
                          {DIMS.map((dim) => {
                            const cell = data.heatmap[field][dim];
                            const avg = cell.avg;
                            return (
                              <td key={dim} className="px-2 py-2 text-center tabular-nums">
                                {cell.count === 0 ? (
                                  <span className="text-zinc-400">—</span>
                                ) : (
                                  <span className="inline-flex items-center justify-center gap-1.5">
                                    <span
                                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotClassForAvg(avg)}`}
                                    />
                                    <span className="text-zinc-900 dark:text-zinc-50">{formatScore(avg)}</span>
                                    <span className="text-zinc-400 dark:text-zinc-500">({cell.count})</span>
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <FieldDocumentsTable data={data} selectedField={selectedField} />
            </div>

            <aside className="flex flex-col gap-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  Stärkste Bereiche
                </h2>
                <p className="mt-0.5 text-[11px] text-emerald-800/90 dark:text-emerald-200/80">
                  Die drei höchsten Matrix-Zellen (Aufgabenfeld–Steuerungsdimension)
                </p>
                <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-emerald-950 dark:text-emerald-50">
                  {data.strongestCells.length === 0 ? (
                    <li className="text-zinc-500">Noch keine ausreichenden Daten.</li>
                  ) : (
                    data.strongestCells.map((c) => (
                      <li key={`${c.field}-${c.dimension}`}>
                        <span className="font-medium">
                          {schulentwicklungFieldLabelDe(c.field)}–{steeringDimensionLabelDe(c.dimension)}
                        </span>
                        <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                          {' '}
                          {c.avg.toFixed(1)}/100
                          <span className="text-zinc-400 dark:text-zinc-500"> ({c.count})</span>
                        </span>
                      </li>
                    ))
                  )}
                </ol>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50/80 p-4 dark:border-red-900/50 dark:bg-red-950/25">
                <h2 className="text-sm font-semibold text-red-900 dark:text-red-100">
                  Größte Baustellen
                </h2>
                <p className="mt-0.5 text-[11px] text-red-800/90 dark:text-red-200/80">
                  Die drei niedrigsten Matrix-Zellen (Aufgabenfeld–Steuerungsdimension)
                </p>
                <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-red-950 dark:text-red-50">
                  {data.weakestCells.length === 0 ? (
                    <li className="text-zinc-500">Noch keine ausreichenden Daten.</li>
                  ) : (
                    data.weakestCells.map((c) => (
                      <li key={`${c.field}-${c.dimension}`}>
                        <span className="font-medium">
                          {schulentwicklungFieldLabelDe(c.field)}–{steeringDimensionLabelDe(c.dimension)}
                        </span>
                        <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
                          {' '}
                          {c.avg.toFixed(1)}/100
                          <span className="text-zinc-400 dark:text-zinc-500"> ({c.count})</span>
                        </span>
                      </li>
                    ))
                  )}
                </ol>
              </div>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Details je Dokument in der{' '}
                <Link href="/documents" className="font-medium text-blue-700 underline dark:text-blue-400">
                  Dokumentenliste
                </Link>
                .
              </p>
            </aside>
          </div>
        </>
      ) : data && !data.ok ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Keine Schuldaten für die Matrix verfügbar.</p>
      ) : null}
    </div>
  );
}
