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
  reachScopeLabel,
} from '../helpers';
import type { DocViewSharedProps } from './docViewProps';

const SvgDots = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="6" r="2.2" fill="currentColor" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" opacity="0.55" />
    <circle cx="12" cy="18" r="2.2" fill="currentColor" opacity="0.25" />
  </svg>
);

const SvgClock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const SvgCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function DocumentCompactView({
  displayedDocs, selectedSet, toggleSelectOne,
  archiveView, rowActionLoadingId, isBusy,
  docTypeLabel, rowActions,
}: DocViewSharedProps) {
  const { handleRowWorkflowStep, handleRowDelete, handleRowArchive, handleRowRestore } = rowActions;
  const rowDisabled = (id: string) => rowActionLoadingId === id || isBusy;

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {displayedDocs.map((doc) => {
          const next = getNextWorkflowTransition(doc.status);
          return (
            <li key={doc.id} className="px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <input type="checkbox" checked={selectedSet.has(doc.id)} onChange={() => toggleSelectOne(doc.id)}
                    aria-label={`Dokument auswählen: ${doc.title}`} className="mt-1" />
                  <div className="min-w-0">
                    <Link href={`/documents/${doc.id}`} className="block truncate text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400">
                      {doc.title}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                      {docTypeLabel(doc.document_type_code)} · {doc.responsible_unit}
                      {doc.gremium ? ` · ${doc.gremium}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${workflowStatusBadgeClass(doc.status)}`}>
                        {statusLabelDe(doc.status)}
                      </span>
                      <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {new Date(doc.created_at).toLocaleDateString('de-DE')}
                      </span>
                      <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        SK {doc.protection_class_id}
                      </span>
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                        reachScopeLabel(doc.reach_scope) === 'extern'
                          ? 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                      }`}>
                        {reachScopeLabel(doc.reach_scope)}
                      </span>
                      {(doc.participation_groups ?? []).length > 0 && (
                        <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                          Beteiligung: {(doc.participation_groups ?? []).slice(0, 1).join('')}
                          {(doc.participation_groups ?? []).length > 1 ? ` +${(doc.participation_groups ?? []).length - 1}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!archiveView && next && (
                    <button type="button"
                      onClick={() => void handleRowWorkflowStep(doc.id, next.next)}
                      disabled={rowDisabled(doc.id)}
                      className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[10px] font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950">
                      {next.label}
                    </button>
                  )}
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
                  {archiveView ? (
                    <>
                      <button type="button" onClick={() => void handleRowRestore(doc.id)} disabled={rowDisabled(doc.id)}
                        className="inline-flex items-center justify-center rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/40">
                        Wiederherst.
                      </button>
                      <button type="button" onClick={() => void handleRowDelete(doc.id)} disabled={rowDisabled(doc.id)}
                        className="inline-flex items-center justify-center rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950">
                        Löschen
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => void handleRowArchive(doc.id)} disabled={rowDisabled(doc.id)}
                      className="inline-flex items-center justify-center rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/40">
                      Archiv
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
