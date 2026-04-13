'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { docTypeLabelDe } from '@/lib/documentMeta';
import { useDocumentMetadataOptions } from '@/app/documents/[id]/hooks/useDocumentMetadataOptions';
import { useDocumentFilters } from './hooks/useDocumentFilters';
import { useDocumentList } from './hooks/useDocumentList';
import { useBulkSelection } from './hooks/useBulkSelection';
import { useBulkActions } from './hooks/useBulkActions';
import { useViewMode } from './hooks/useViewMode';
import { DocumentFilterBar } from './components/DocumentFilterBar';
import { BulkActionsBar } from './components/BulkActionsBar';
import { DocumentTableView } from './components/DocumentTableView';
import { DocumentCardsView } from './components/DocumentCardsView';
import { DocumentCompactView } from './components/DocumentCompactView';
import type { SortField, SortDir } from './types';

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const archiveView = searchParams.get('archive') === '1';

  // ── Filter & view state ────────────────────────────────────────────────────
  const filters = useDocumentFilters();
  const [viewMode, setViewMode] = useViewMode();
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Data ───────────────────────────────────────────────────────────────────
  const { docs, setDocs, loading, error, reload, cancelInFlight } = useDocumentList(filters, archiveView);
  const { documentTypeOptions, responsibleUnitOptions } = useDocumentMetadataOptions();

  // ── Selection + bulk ───────────────────────────────────────────────────────
  const allVisibleIds = useMemo(() => docs.map((d) => d.id), [docs]);

  const selection = useBulkSelection();
  const bulkActions = useBulkActions({
    docs,
    selectedIds: selection.selectedIds,
    editableSelectedIds: selection.editableSelectedIds,
    setDocs,
    clearSelection: selection.clearSelection,
    reload,
    cancelInFlight,
  });

  const toggleSelectAll = () => {
    bulkActions.clearAllResults();
    selection.toggleSelectAll(allVisibleIds);
  };
  const toggleSelectOne = (id: string) => {
    bulkActions.clearAllResults();
    selection.toggleSelectOne(id);
  };

  // ── Sort & display ─────────────────────────────────────────────────────────
  const cycleSort = (field: SortField) => {
    if (field !== sortField) { setSortField(field); setSortDir('desc'); return; }
    if (sortDir === 'desc') { setSortDir('asc'); return; }
    setSortField('created_at'); setSortDir('desc');
  };
  const sortIndicator = (field: SortField): string | null => {
    if (field !== sortField) return null;
    return sortDir === 'asc' ? '↑' : '↓';
  };
  const displayedDocs = useMemo(() => [...docs].sort((a, b) => {
    const m = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'created_at') return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * m;
    if (sortField === 'title') return a.title.localeCompare(b.title, 'de-DE') * m;
    if (sortField === 'document_type_code') return a.document_type_code.localeCompare(b.document_type_code, 'de-DE') * m;
    if (sortField === 'status') return a.status.localeCompare(b.status, 'de-DE') * m;
    return 0;
  }), [docs, sortField, sortDir]);

  const docTypeLabel = (code: string) => docTypeLabelDe(code, documentTypeOptions);
  const allSelected = allVisibleIds.length > 0 && selection.selectedIds.length === allVisibleIds.length;
  const noneSelected = selection.selectedIds.length === 0;

  const rowActions = {
    handleRowWorkflowStep: bulkActions.handleRowWorkflowStep,
    handleRowDelete: bulkActions.handleRowDelete,
    handleRowArchive: bulkActions.handleRowArchive,
    handleRowRestore: bulkActions.handleRowRestore,
  };

  const hasResults =
    bulkActions.bulkDeleteResult ??
    bulkActions.bulkUpdateResult ??
    bulkActions.bulkSummarizeResult ??
    bulkActions.bulkSteeringResult;

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">

        {/* Header */}
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-3 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold">{archiveView ? 'Archiv' : 'Dokumente'}</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {archiveView
                ? 'Archivierte Dokumente — weiterhin unter „Aktuelle Anfragen" verlinkbar; hier wiederherstellen oder endgültig löschen.'
                : 'Liste der in der Dokumentenbasis gespeicherten schulischen Dokumente.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => {
                const p = new URLSearchParams(searchParams.toString());
                if (archiveView) p.delete('archive'); else p.set('archive', '1');
                router.push(`/documents${p.toString() ? `?${p.toString()}` : ''}`);
              }}
              className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {archiveView ? 'Zur aktiven Liste' : 'Archiv anzeigen'}
            </button>
            {!archiveView && (
              <Link href="/upload" className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700">
                Dokumente hochladen
              </Link>
            )}
            <Link href="/" className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
              ← Zur Startseite
            </Link>
          </div>
        </header>

        {/* Filter-Leiste */}
        <DocumentFilterBar
          {...filters}
          typeOptions={documentTypeOptions}
          responsibleUnitOptions={responsibleUnitOptions}
          onResetFilters={filters.resetFilters}
        />

        {/* Ergebnis-Hinweis */}
        {!loading && !error && hasResults && (
          <section className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-zinc-600 dark:text-zinc-300">{hasResults}</span>
          </section>
        )}

        {/* Auswahl: Alle / Keine */}
        {!loading && !error && docs.length > 0 && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-zinc-700 dark:text-zinc-200">Alle</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={noneSelected}
                  onChange={() => { bulkActions.clearAllResults(); selection.clearSelection(); }}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-zinc-700 dark:text-zinc-200">Keine</span>
              </label>
            </div>
            <span className="text-zinc-600 dark:text-zinc-300">
              Ausgewählt: <span className="font-semibold">{selection.selectedIds.length}</span>
            </span>
          </section>
        )}

        {/* Bulk-Aktionen */}
        {!loading && !error && docs.length > 0 && selection.selectedIds.length > 1 && (
          <BulkActionsBar
            {...bulkActions}
            selectedIds={selection.selectedIds}
            editableSelectedIds={selection.editableSelectedIds}
            blockedSelectedIds={selection.blockedSelectedIds}
            bulkCapabilitiesLoading={selection.bulkCapabilitiesLoading}
            archiveView={archiveView}
          />
        )}

        {/* Ansicht-Toggle */}
        {!loading && !error && docs.length > 0 && (
          <section className="flex items-center justify-end">
            <div className="inline-flex rounded border border-zinc-300 bg-white p-0.5 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              {(['table', 'cards', 'compact'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded px-2 py-1 font-medium transition ${
                    viewMode === mode
                      ? 'bg-blue-50 text-zinc-900 dark:bg-blue-950/40 dark:text-zinc-50'
                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  {{ table: 'Tabelle', cards: 'Karten', compact: 'Kompakt' }[mode]}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Lade-Skelett */}
        {loading && (
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-zinc-200 bg-white text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-zinc-100 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  {[4, 48, 16, 16, 24, 10, 24, 28, 32].map((w, i) => (
                    <th key={i} className="px-3 py-2 text-left">
                      <div className={`h-3.5 w-${w} animate-pulse rounded bg-zinc-200 dark:bg-zinc-700`} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="border-t border-zinc-200 odd:bg-white even:bg-zinc-50 dark:border-zinc-800 dark:odd:bg-zinc-900 dark:even:bg-zinc-950/30">
                    {[4, 48, 28, 24, 28, 14, 28, 24].map((w, i) => (
                      <td key={i} className="px-3 py-2">
                        <div className={`h-3.5 w-${w} animate-pulse rounded bg-zinc-200 dark:bg-zinc-700`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Fehler */}
        {error && <p className="text-sm text-red-600">Fehler beim Laden der Dokumente: {error}</p>}

        {/* Leer */}
        {!loading && !error && docs.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Es wurden noch keine Dokumente gefunden.</p>
        )}

        {/* Tabellenansicht */}
        {!loading && !error && docs.length > 0 && viewMode === 'table' && (
          <DocumentTableView
            displayedDocs={displayedDocs}
            selectedIds={selection.selectedIds}
            toggleSelectOne={toggleSelectOne}
            allSelected={allSelected}
            toggleSelectAll={toggleSelectAll}
            archiveView={archiveView}
            rowActionLoadingId={bulkActions.rowActionLoadingId}
            isBusy={bulkActions.isBusy}
            docTypeLabel={docTypeLabel}
            rowActions={rowActions}
            sortField={sortField}
            sortDir={sortDir}
            cycleSort={cycleSort}
            sortIndicator={sortIndicator}
          />
        )}

        {/* Kartenansicht */}
        {!loading && !error && docs.length > 0 && viewMode === 'cards' && (
          <DocumentCardsView
            displayedDocs={displayedDocs}
            selectedIds={selection.selectedIds}
            toggleSelectOne={toggleSelectOne}
            archiveView={archiveView}
            rowActionLoadingId={bulkActions.rowActionLoadingId}
            isBusy={bulkActions.isBusy}
            docTypeLabel={docTypeLabel}
            rowActions={rowActions}
          />
        )}

        {/* Kompaktansicht */}
        {!loading && !error && docs.length > 0 && viewMode === 'compact' && (
          <DocumentCompactView
            displayedDocs={displayedDocs}
            selectedIds={selection.selectedIds}
            toggleSelectOne={toggleSelectOne}
            archiveView={archiveView}
            rowActionLoadingId={bulkActions.rowActionLoadingId}
            isBusy={bulkActions.isBusy}
            docTypeLabel={docTypeLabel}
            rowActions={rowActions}
          />
        )}

      </div>
    </main>
  );
}
