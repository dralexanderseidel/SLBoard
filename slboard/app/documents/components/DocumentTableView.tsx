'use client';

import React from 'react';
import Link from 'next/link';
import {
  getNextWorkflowTransition,
  statusLabelDe,
  workflowStatusBadgeClass,
} from '@/lib/documentWorkflow';
import {
  steeringNeedScore, steeringIconTone, steeringIconTitle,
  reachScopeLabel, renderParticipationBadges, isToday, isYesterday,
} from '../helpers';
import type { DocTableViewProps } from './docViewProps';

const SvgCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SvgClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const SORT_COLUMNS = [
  { field: 'title' as const, label: 'Titel' },
  { field: 'document_type_code' as const, label: 'Typ' },
  { field: 'status' as const, label: 'Status' },
  { field: 'created_at' as const, label: 'Erstellt am' },
];

const SvgDots = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="6" r="2.3" fill="currentColor" />
    <circle cx="12" cy="12" r="2.3" fill="currentColor" opacity="0.55" />
    <circle cx="12" cy="18" r="2.3" fill="currentColor" opacity="0.25" />
  </svg>
);

export function DocumentTableView({
  displayedDocs, selectedSet, toggleSelectOne,
  allSelected, toggleSelectAll,
  archiveView, rowActionLoadingId, isBusy,
  docTypeLabel, rowActions,
  cycleSort, sortIndicator,
}: DocTableViewProps) {
  const { handleRowWorkflowStep, handleRowDelete, handleRowArchive, handleRowRestore } = rowActions;
  const rowDisabled = (id: string) => rowActionLoadingId === id || isBusy;

  return (
    <div className="max-h-[60vh] overflow-auto rounded-lg border border-zinc-200 bg-white text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <table className="min-w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-zinc-100 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <tr>
            <th className="px-3 py-2 text-left">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Alle auswählen" />
            </th>
            {SORT_COLUMNS.map(({ field, label }) => {
              const indicator = sortIndicator(field);
              return (
                <th key={field} className="px-3 py-2 text-left">
                  <button type="button" onClick={() => cycleSort(field)} className="inline-flex items-center gap-1 hover:underline">
                    {label}
                    {indicator && <span className="text-[11px] text-zinc-500">{indicator}</span>}
                  </button>
                </th>
              );
            })}
            <th className="px-3 py-2 text-left">KI-Status</th>
            <th className="px-3 py-2 text-left">Beschlussgremium</th>
            <th className="px-3 py-2 text-left">Verantwortlich</th>
            <th className="px-3 py-2 text-left">Reichweite</th>
            <th className="px-3 py-2 text-left">Beteiligung</th>
            <th className="px-3 py-2 text-left">Schutzklasse</th>
          </tr>
        </thead>
        <tbody>
          {displayedDocs.map((doc) => (
            <tr
              key={doc.id}
              className={`border-t border-zinc-200 odd:bg-white even:bg-zinc-50 dark:border-zinc-800 dark:odd:bg-zinc-900 dark:even:bg-zinc-950 ${
                isToday(doc.created_at) ? 'bg-blue-50 dark:bg-zinc-900/30' : isYesterday(doc.created_at) ? 'bg-blue-50/40 dark:bg-zinc-900/20' : ''
              }`}
            >
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedSet.has(doc.id)}
                  onChange={() => toggleSelectOne(doc.id)}
                  aria-label={`Dokument auswählen: ${doc.title}`}
                />
              </td>

              {/* Titel + Aktion */}
              <td className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/documents/${doc.id}`} className="min-w-0 flex-1 truncate text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
                    {doc.title}
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    {archiveView ? (
                      <>
                        <button type="button" onClick={() => void handleRowRestore(doc.id)} disabled={rowDisabled(doc.id)}
                          className="inline-flex items-center justify-center rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/40">
                          Wiederherstellen
                        </button>
                        <button type="button" onClick={() => void handleRowDelete(doc.id)} disabled={rowDisabled(doc.id)}
                          className="inline-flex items-center justify-center rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950">
                          Löschen
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => void handleRowArchive(doc.id)} disabled={rowDisabled(doc.id)}
                        className="inline-flex items-center justify-center rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/40">
                        Archiv
                      </button>
                    )}
                  </div>
                </div>
              </td>

              {/* Typ */}
              <td className="px-3 py-2">{docTypeLabel(doc.document_type_code)}</td>

              {/* Status */}
              <td className="px-3 py-2">
                {(() => {
                  const next = getNextWorkflowTransition(doc.status);
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${workflowStatusBadgeClass(doc.status)}`}>
                        {statusLabelDe(doc.status)}
                      </span>
                      {!archiveView && next && (
                        <button type="button"
                          onClick={() => void handleRowWorkflowStep(doc.id, next.next)}
                          disabled={rowDisabled(doc.id)}
                          className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950">
                          {next.label}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </td>

              {/* Erstellt am */}
              <td className="px-3 py-2">
                <span>{new Date(doc.created_at).toLocaleDateString('de-DE')}</span>
                {isToday(doc.created_at) && (
                  <span className="ml-2 inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">Neu</span>
                )}
                {isYesterday(doc.created_at) && !isToday(doc.created_at) && (
                  <span className="ml-2 inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">Gestern</span>
                )}
              </td>

              {/* KI-Status */}
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Link href={`/documents/${doc.id}?focus=summary`} aria-label="Zur Zusammenfassung springen"
                    className={`inline-flex items-center justify-center rounded border p-1 transition ${
                      doc.summary && doc.summary.trim().length > 0
                        ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950'
                        : 'border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600 dark:hover:bg-zinc-800'
                    }`}>
                    {doc.summary && doc.summary.trim().length > 0 ? <SvgCheck /> : <SvgClock />}
                  </Link>
                  <Link href={`/documents/${doc.id}?focus=steering`} aria-label="Zur Steuerungsanalyse springen"
                    title={steeringIconTitle(doc)}
                    className={`inline-flex items-center justify-center rounded border p-1 transition ${steeringIconTone(doc)}`}>
                    {steeringNeedScore(doc) ? <SvgDots /> : <SvgClock />}
                  </Link>
                </div>
              </td>

              <td className="px-3 py-2">{doc.gremium ?? '—'}</td>
              <td className="px-3 py-2">{doc.responsible_unit}</td>

              {/* Reichweite */}
              <td className="px-3 py-2">
                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                  reachScopeLabel(doc.reach_scope) === 'extern'
                    ? 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                }`}>
                  {reachScopeLabel(doc.reach_scope)}
                </span>
              </td>
              <td className="px-3 py-2">{renderParticipationBadges(doc.participation_groups)}</td>
              <td className="px-3 py-2">{doc.protection_class_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
