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
import type { DocViewSharedProps } from './docViewProps';

const SvgDots = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="6" r="2.3" fill="currentColor" />
    <circle cx="12" cy="12" r="2.3" fill="currentColor" opacity="0.55" />
    <circle cx="12" cy="18" r="2.3" fill="currentColor" opacity="0.25" />
  </svg>
);

const SvgClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const SvgCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function DocumentCardsView({
  displayedDocs, selectedIds, toggleSelectOne,
  archiveView, rowActionLoadingId, isBusy,
  docTypeLabel, rowActions,
}: DocViewSharedProps) {
  const { handleRowWorkflowStep, handleRowDelete, handleRowArchive, handleRowRestore } = rowActions;
  const rowDisabled = (id: string) => rowActionLoadingId === id || isBusy;

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {displayedDocs.map((doc) => (
        <article
          key={doc.id}
          className={`rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:shadow dark:border-zinc-800 dark:bg-zinc-900 ${
            isToday(doc.created_at) ? 'ring-1 ring-blue-200 dark:ring-blue-900/40' : isYesterday(doc.created_at) ? 'ring-1 ring-zinc-200 dark:ring-zinc-700' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <input type="checkbox" checked={selectedIds.includes(doc.id)} onChange={() => toggleSelectOne(doc.id)}
                aria-label={`Dokument auswählen: ${doc.title}`} className="mt-1" />
              <div className="min-w-0">
                <Link href={`/documents/${doc.id}`} className="block truncate text-sm font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-400">
                  {doc.title}
                </Link>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
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

          <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            {docTypeLabel(doc.document_type_code)} · {doc.responsible_unit}
            {doc.gremium ? ` · ${doc.gremium}` : ''}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${workflowStatusBadgeClass(doc.status)}`}>
              {statusLabelDe(doc.status)}
            </span>
            {!archiveView && getNextWorkflowTransition(doc.status) && (
              <button type="button"
                onClick={() => void handleRowWorkflowStep(doc.id, getNextWorkflowTransition(doc.status)!.next)}
                disabled={rowDisabled(doc.id)}
                className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950">
                {getNextWorkflowTransition(doc.status)!.label}
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {new Date(doc.created_at).toLocaleDateString('de-DE')}
            </span>
            {isToday(doc.created_at) && (
              <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">Neu</span>
            )}
            {isYesterday(doc.created_at) && !isToday(doc.created_at) && (
              <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">Gestern</span>
            )}
            <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              Schutzklasse {doc.protection_class_id}
            </span>
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${
              reachScopeLabel(doc.reach_scope) === 'extern'
                ? 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
            }`}>
              {reachScopeLabel(doc.reach_scope)}
            </span>
            <Link href={`/documents/${doc.id}?focus=summary`} aria-label="Zur Zusammenfassung springen"
              title={doc.summary && doc.summary.trim().length > 0 ? 'KI-Zusammenfassung vorhanden' : 'Noch keine KI-Zusammenfassung'}
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

          {(doc.participation_groups ?? []).length > 0 && (
            <div className="mt-2">{renderParticipationBadges(doc.participation_groups)}</div>
          )}
        </article>
      ))}
    </section>
  );
}
