'use client';

import React from 'react';
import { LONG_RUNNING_EXPECTATION_HINT } from '@/lib/longRunningExpectationHint';
import type { BulkActionsResult } from '../hooks/useBulkActions';

type Props = Pick<
  BulkActionsResult,
  | 'bulkDeleting' | 'bulkArchiving' | 'bulkUpdating' | 'bulkSummarizing' | 'bulkSteeringAnalyzing'
  | 'bulkSummariesArmed' | 'setBulkSummariesArmed'
  | 'bulkSteeringArmed' | 'setBulkSteeringArmed'
  | 'handleBulkDelete' | 'handleBulkArchive' | 'handleBulkRestore'
  | 'handleBulkSetStatus' | 'handleBulkSetProtectionClass' | 'handleBulkSetReachScope'
  | 'handleBulkGenerateSummaries' | 'handleBulkGenerateSteeringAnalyses'
> & {
  selectedIds: string[];
  editableSelectedIds: string[];
  blockedSelectedIds: string[];
  bulkCapabilitiesLoading: boolean;
  archiveView: boolean;
  /** Wenn false, werden Batch-KI-Aktionen ausgeblendet (Schul-Feature-Flag). */
  featureAiEnabled?: boolean;
};

export function BulkActionsBar({
  selectedIds, editableSelectedIds, blockedSelectedIds,
  bulkCapabilitiesLoading, archiveView,
  bulkDeleting, bulkArchiving, bulkUpdating, bulkSummarizing, bulkSteeringAnalyzing,
  bulkSummariesArmed, setBulkSummariesArmed,
  bulkSteeringArmed, setBulkSteeringArmed,
  handleBulkDelete, handleBulkArchive, handleBulkRestore,
  handleBulkSetStatus, handleBulkSetProtectionClass, handleBulkSetReachScope,
  handleBulkGenerateSummaries, handleBulkGenerateSteeringAnalyses,
  featureAiEnabled = true,
}: Props) {
  const bulkAiBusy = bulkSummarizing || bulkSteeringAnalyzing;
  const anyBusy = bulkDeleting || bulkArchiving || bulkUpdating || bulkAiBusy;

  const btnDisabled =
    selectedIds.length === 0 ||
    bulkCapabilitiesLoading ||
    editableSelectedIds.length === 0 ||
    anyBusy;

  const btnClass =
    'rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950';

  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 pb-2 dark:border-zinc-800">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
          Mehrfachänderung
        </p>
        <p className="mt-0.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
          Die folgenden Aktionen gelten gleichzeitig für alle ausgewählten Dokumente, die Sie ändern dürfen
          (Massenänderung).
        </p>
      </div>

      {/* Auswahl-Übersicht */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-zinc-600 dark:text-zinc-300">
          Ausgewählt: <span className="font-semibold">{selectedIds.length}</span>
        </span>
        {bulkCapabilitiesLoading ? (
          <span className="text-zinc-500 dark:text-zinc-400">Prüfe Berechtigungen…</span>
        ) : (
          <span className="text-zinc-600 dark:text-zinc-300">
            Änderbar: <span className="font-semibold">{editableSelectedIds.length}</span>
            {blockedSelectedIds.length > 0 && (
              <> {' · '}Nicht änderbar: <span className="font-semibold">{blockedSelectedIds.length}</span></>
            )}
          </span>
        )}
      </div>

      {!bulkCapabilitiesLoading && blockedSelectedIds.length > 0 && (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Hinweis: Ein Teil der Auswahl ist nicht änderbar (z. B. wegen Rolle/Verantwortlich/Schutzklasse).
        </p>
      )}

      {/* Aktionen */}
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
        <span className="w-28 shrink-0 text-zinc-600 dark:text-zinc-300">Aktionen</span>
        {!archiveView && (
          <button
            type="button"
            onClick={() => void handleBulkArchive()}
            disabled={btnDisabled}
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-zinc-50 dark:hover:bg-amber-950/40"
          >
            {bulkArchiving ? '…' : 'Ausgewählte ins Archiv'}
          </button>
        )}
        {archiveView && (
          <>
            <button
              type="button"
              onClick={() => void handleBulkRestore()}
              disabled={btnDisabled}
              className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-zinc-50 dark:hover:bg-emerald-950/40"
            >
              {bulkArchiving ? '…' : 'Ausgewählte wiederherstellen'}
            </button>
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={btnDisabled}
              className={btnClass}
            >
              {bulkDeleting ? 'Lösche…' : 'Endgültig löschen'}
            </button>
          </>
        )}
      </div>

      {!archiveView && (
        <>
          {/* Status */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
            <span className="w-28 shrink-0 text-zinc-600 dark:text-zinc-300">Status</span>
            {(['ENTWURF', 'FREIGEGEBEN', 'BESCHLUSS', 'VEROEFFENTLICHT'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void handleBulkSetStatus(s)}
                disabled={btnDisabled}
                className={btnClass}
              >
                {bulkUpdating ? '…' : { ENTWURF: 'Entwurf', FREIGEGEBEN: 'Freigegeben', BESCHLUSS: 'Beschluss', VEROEFFENTLICHT: 'Veröffentlicht' }[s]}
              </button>
            ))}
          </div>

          {/* Schutzklasse */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
            <span className="w-28 shrink-0 text-zinc-600 dark:text-zinc-300">Schutzklasse</span>
            {([1, 2, 3] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => void handleBulkSetProtectionClass(c)}
                disabled={btnDisabled}
                className={btnClass}
              >
                {bulkUpdating ? '…' : String(c)}
              </button>
            ))}
          </div>

          {/* Reichweite */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
            <span className="w-28 shrink-0 text-zinc-600 dark:text-zinc-300">Reichweite</span>
            {(['intern', 'extern'] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => void handleBulkSetReachScope(scope)}
                disabled={btnDisabled}
                className={btnClass}
              >
                {bulkUpdating ? '…' : scope}
              </button>
            ))}
          </div>

          {/* KI */}
          {featureAiEnabled ? (
          <div className="flex flex-col gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 shrink-0 text-zinc-600 dark:text-zinc-300">KI</span>
              <label className="inline-flex cursor-pointer items-center gap-2 text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={bulkSummariesArmed}
                  onChange={(e) => setBulkSummariesArmed(e.target.checked)}
                  disabled={btnDisabled}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-zinc-600"
                />
                <span className="text-[11px] font-medium">Zusammenfassung (Batch)</span>
              </label>
              <button
                type="button"
                onClick={() => void handleBulkGenerateSummaries()}
                disabled={btnDisabled || !bulkSummariesArmed}
                className={btnClass}
              >
                {bulkSummarizing ? 'KI fasst zusammen…' : 'Zusammenfassungen erzeugen'}
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={bulkSteeringArmed}
                  onChange={(e) => setBulkSteeringArmed(e.target.checked)}
                  disabled={btnDisabled}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-zinc-600"
                />
                <span className="text-[11px] font-medium">Steuerungsanalyse (Batch)</span>
              </label>
              <button
                type="button"
                onClick={() => void handleBulkGenerateSteeringAnalyses()}
                disabled={btnDisabled || !bulkSteeringArmed}
                className={btnClass}
              >
                {bulkSteeringAnalyzing ? 'KI analysiert…' : 'Steuerungsanalysen erzeugen'}
              </button>
            </div>
            {bulkAiBusy && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400" aria-live="polite">
                {LONG_RUNNING_EXPECTATION_HINT}
              </p>
            )}
          </div>
          ) : null}
        </>
      )}
    </section>
  );
}
