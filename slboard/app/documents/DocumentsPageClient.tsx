'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildDashboardDocsHref } from '@/lib/dashboardDocSelection';
import { docTypeLabelDe } from '@/lib/documentMeta';
import { useDocumentMetadataOptions } from '@/app/documents/[id]/hooks/useDocumentMetadataOptions';
import { useDocumentFilters } from './hooks/useDocumentFilters';
import { useDocumentList } from './hooks/useDocumentList';
import { useBulkSelection } from './hooks/useBulkSelection';
import { useBulkActions } from './hooks/useBulkActions';
import { useViewMode } from './hooks/useViewMode';
import { DocumentFilterBar } from './components/DocumentFilterBar';
import { BulkActionsBar } from './components/BulkActionsBar';
import { BulkActionResultPanel } from './components/BulkActionResultPanel';
import { DocumentTableView } from './components/DocumentTableView';
import { DocumentCardsView } from './components/DocumentCardsView';
import { DocumentCompactView } from './components/DocumentCompactView';
import { DocumentListPagination } from './components/DocumentListPagination';
import { ApiErrorCallout } from '@/components/ApiErrorCallout';
import { useHeaderAccess } from '@/components/HeaderAccessContext';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';
import type { SortField, SortDir } from './types';

const DOCUMENT_LIST_PAGE_SIZE = 25;

export function DocumentsPageClient() {
  const { access, accessLoading } = useHeaderAccess();
  const featureAiEnabled = access?.featureAiEnabled !== false;

  const router = useRouter();
  const searchParams = useSearchParams();
  const archiveView = searchParams.get('archive') === '1';
  const urlQ = searchParams.get('q') ?? '';
  const urlAuftragfeld = searchParams.get('auftragfeld') ?? '';
  const urlSePrimary = searchParams.get('sePrimary') ?? '';

  // ── Filter & view state ────────────────────────────────────────────────────
  const filters = useDocumentFilters(urlQ, urlAuftragfeld, urlSePrimary);

  // Sync URL ?q param to filters on subsequent client-side navigations
  // (e.g. from the global header search). Initial value is already handled
  // by the useDocumentFilters initializer above.
  const prevUrlQ = useRef(urlQ);
  useEffect(() => {
    if (urlQ !== prevUrlQ.current) {
      prevUrlQ.current = urlQ;
      filters.setSearchDirect(urlQ);
    }
  }, [urlQ, filters.setSearchDirect]);

  const prevUrlAuftragfeld = useRef(urlAuftragfeld);
  useEffect(() => {
    if (urlAuftragfeld !== prevUrlAuftragfeld.current) {
      prevUrlAuftragfeld.current = urlAuftragfeld;
      filters.setSchulentwicklungFieldFilter(urlAuftragfeld.trim());
    }
  }, [urlAuftragfeld, filters.setSchulentwicklungFieldFilter]);

  const prevUrlSePrimary = useRef(urlSePrimary);
  useEffect(() => {
    if (urlSePrimary !== prevUrlSePrimary.current) {
      prevUrlSePrimary.current = urlSePrimary;
      filters.setSchulentwicklungPrimaryFieldFilter(urlSePrimary.trim());
    }
  }, [urlSePrimary, filters.setSchulentwicklungPrimaryFieldFilter]);
  const [viewMode, setViewMode] = useViewMode();
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Data ───────────────────────────────────────────────────────────────────
  const { docs, setDocs, loading, error, listMeta, reload, cancelInFlight } = useDocumentList(
    filters,
    archiveView,
    sortField,
    sortDir,
  );
  const { documentTypeOptions, responsibleUnitOptions } = useDocumentMetadataOptions();

  const [listPage, setListPage] = useState(1);

  const listPageDepsKey = useMemo(
    () =>
      [
        filters.typeFilter,
        filters.responsibleUnitFilter,
        filters.statusFilters.join('\u0001'),
        filters.protectionFilter,
        filters.reachScopeFilters.join('\u0001'),
        filters.participationFilter,
        filters.gremiumFilter,
        filters.reviewFilter,
        filters.summaryFilter,
        filters.steeringFilter,
        filters.schulentwicklungFieldFilter,
        filters.schulentwicklungPrimaryFieldFilter,
        filters.searchQuery,
        archiveView,
        sortField,
        sortDir,
      ].join('|'),
    [
      filters.typeFilter,
      filters.responsibleUnitFilter,
      filters.statusFilters,
      filters.protectionFilter,
      filters.reachScopeFilters,
      filters.participationFilter,
      filters.gremiumFilter,
      filters.reviewFilter,
      filters.summaryFilter,
      filters.steeringFilter,
      filters.schulentwicklungFieldFilter,
      filters.schulentwicklungPrimaryFieldFilter,
      filters.searchQuery,
      archiveView,
      sortField,
      sortDir,
    ],
  );

  useEffect(() => {
    setListPage(1);
  }, [listPageDepsKey]);

  const listTotalPages = useMemo(
    () => Math.max(1, Math.ceil(docs.length / DOCUMENT_LIST_PAGE_SIZE)),
    [docs.length],
  );

  const listPageClamped = Math.min(Math.max(1, listPage), listTotalPages);

  useEffect(() => {
    if (listPage !== listPageClamped) setListPage(listPageClamped);
  }, [listPage, listPageClamped]);

  const pagedDocs = useMemo(
    () =>
      docs.slice(
        (listPageClamped - 1) * DOCUMENT_LIST_PAGE_SIZE,
        listPageClamped * DOCUMENT_LIST_PAGE_SIZE,
      ),
    [docs, listPageClamped],
  );

  // ── Selection + bulk ───────────────────────────────────────────────────────
  const allVisibleIds = useMemo(() => pagedDocs.map((d) => d.id), [pagedDocs]);

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

  const selectedSet = useMemo(() => new Set(selection.selectedIds), [selection.selectedIds]);

  const toggleSelectAll = useCallback(() => {
    bulkActions.clearAllResults();
    selection.toggleSelectAll(allVisibleIds);
  }, [bulkActions, selection, allVisibleIds]);

  const toggleSelectOne = useCallback((id: string) => {
    bulkActions.clearAllResults();
    selection.toggleSelectOne(id);
  }, [bulkActions, selection]);

  // ── Sort & display ─────────────────────────────────────────────────────────
  const cycleSort = useCallback((field: SortField) => {
    if (field !== sortField) { setSortField(field); setSortDir('desc'); return; }
    if (sortDir === 'desc') { setSortDir('asc'); return; }
    setSortField('created_at'); setSortDir('desc');
  }, [sortField, sortDir]);

  const sortIndicator = useCallback((field: SortField): string | null => {
    if (field !== sortField) return null;
    return sortDir === 'asc' ? '↑' : '↓';
  }, [sortField, sortDir]);

  const displayedDocs = pagedDocs;

  const docTypeLabel = useCallback((code: string) => docTypeLabelDe(code, documentTypeOptions), [documentTypeOptions]);
  const allSelected = allVisibleIds.length > 0 && selection.selectedIds.length === allVisibleIds.length;
  const noneSelected = selection.selectedIds.length === 0;

  const rowActions = useMemo(() => ({
    handleRowWorkflowStep: bulkActions.handleRowWorkflowStep,
    handleRowDelete: bulkActions.handleRowDelete,
    handleRowArchive: bulkActions.handleRowArchive,
    handleRowRestore: bulkActions.handleRowRestore,
  }), [bulkActions]);

  const hasBulkFeedback =
    !!bulkActions.bulkDeleteResult ||
    !!bulkActions.bulkUpdateResult ||
    !!bulkActions.bulkSummarizeResult ||
    !!bulkActions.bulkSteeringResult;

  const hasActiveFilters = !!(
    filters.searchQuery ||
    filters.typeFilter ||
    filters.responsibleUnitFilter ||
    filters.statusFilters.length > 0 ||
    filters.protectionFilter ||
    filters.reachScopeFilters.length > 0 ||
    filters.participationFilter ||
    filters.gremiumFilter ||
    filters.reviewFilter ||
    filters.summaryFilter ||
    filters.steeringFilter ||
    filters.schulentwicklungFieldFilter ||
    filters.schulentwicklungPrimaryFieldFilter
  );

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className={`${APP_PAGE_MAX_OUTER_CLASS} flex flex-col gap-6 py-6 sm:py-8`}>

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

        {!accessLoading && access?.orgUnit?.trim() && (
          <section className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="font-medium text-zinc-600 dark:text-zinc-400">Schnellfilter</span>
            <button
              type="button"
              onClick={() => {
                const u = access.orgUnit!.trim();
                filters.setResponsibleUnitFilter(filters.responsibleUnitFilter === u ? '' : u);
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                filters.responsibleUnitFilter === access.orgUnit!.trim()
                  ? 'border-blue-400 bg-blue-50 text-blue-950 dark:border-blue-600 dark:bg-blue-950/50 dark:text-blue-50'
                  : 'border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Nur meine Organisationseinheit
            </button>
          </section>
        )}

        {/* Filter-Leiste */}
        <DocumentFilterBar
          {...filters}
          typeOptions={documentTypeOptions}
          responsibleUnitOptions={responsibleUnitOptions}
          onResetFilters={filters.resetFilters}
        />

        {!loading && !error && docs.length > 0 && listMeta?.truncated && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            Die Datenbankabfrage wurde am Serverlimit begrenzt. Es können weitere Dokumente existieren, die hier nicht
            erscheinen — bitte Filter oder Suche verfeinern.
          </p>
        )}

        {/* Ergebnis-Hinweis */}
        {!loading && !error && hasBulkFeedback && (
          <div className="flex flex-col gap-2">
            {bulkActions.bulkDeleteResult && (
              <BulkActionResultPanel summary={bulkActions.bulkDeleteResult} />
            )}
            {bulkActions.bulkUpdateResult && (
              <BulkActionResultPanel summary={bulkActions.bulkUpdateResult} />
            )}
            {bulkActions.bulkSummarizeResult && (
              <BulkActionResultPanel summary={bulkActions.bulkSummarizeResult} />
            )}
            {bulkActions.bulkSteeringResult && (
              <BulkActionResultPanel summary={bulkActions.bulkSteeringResult} />
            )}
          </div>
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
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-zinc-600 dark:text-zinc-300">
                Ausgewählt: <span className="font-semibold">{selection.selectedIds.length}</span>
              </span>
              {!archiveView && featureAiEnabled && selection.selectedIds.length > 0 && (
                <Link
                  href={buildDashboardDocsHref(selection.selectedIds)}
                  className="inline-flex h-8 items-center rounded-md border border-blue-300 bg-blue-50 px-3 text-xs font-medium text-blue-950 shadow-sm transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-50 dark:hover:bg-blue-950/70"
                >
                  Auf der Startseite fragen
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Bulk-Aktionen */}
        {!loading && !error && docs.length > 0 && selection.selectedIds.length > 0 && (
          <BulkActionsBar
            {...bulkActions}
            selectedIds={selection.selectedIds}
            editableSelectedIds={selection.editableSelectedIds}
            blockedSelectedIds={selection.blockedSelectedIds}
            bulkCapabilitiesLoading={selection.bulkCapabilitiesLoading}
            archiveView={archiveView}
            featureAiEnabled={featureAiEnabled}
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
                  {(['w-4', 'w-48', 'w-16', 'w-16', 'w-24', 'w-10', 'w-24', 'w-28', 'w-32'] as const).map((w, i) => (
                    <th key={i} className="px-3 py-2 text-left">
                      <div className={`h-3.5 ${w} animate-pulse rounded bg-zinc-200 dark:bg-zinc-700`} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="border-t border-zinc-200 odd:bg-white even:bg-zinc-50 dark:border-zinc-800 dark:odd:bg-zinc-900 dark:even:bg-zinc-950/30">
                    {(['w-4', 'w-48', 'w-28', 'w-24', 'w-28', 'w-14', 'w-28', 'w-24'] as const).map((w, i) => (
                      <td key={i} className="px-3 py-2">
                        <div className={`h-3.5 ${w} animate-pulse rounded bg-zinc-200 dark:bg-zinc-700`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Fehler */}
        {error && <ApiErrorCallout error={error} title="Dokumentenliste" className="text-sm" />}

        {/* Leer */}
        {!loading && !error && docs.length === 0 && (
          hasActiveFilters ? (
            /* Kein Treffer für aktive Filter */
            <div className="flex flex-col items-center gap-4 rounded-lg border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <svg className="h-6 w-6 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Keine Treffer</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Kein Dokument entspricht den aktiven Filtern oder dem Suchbegriff.
                </p>
              </div>
              <button
                type="button"
                onClick={filters.resetFilters}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                Filter zurücksetzen
              </button>
            </div>
          ) : (
            /* Neue Schule – noch keine Dokumente vorhanden */
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col items-center gap-4 border-b border-zinc-100 px-6 py-10 text-center dark:border-zinc-800">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40">
                  <svg className="h-7 w-7 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    Noch keine Dokumente vorhanden
                  </h2>
                  <p className="mt-1.5 max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
                    Laden Sie das erste schulische Dokument hoch, um die Dokumentenbasis aufzubauen.
                    Anschließend stehen KI-Suche, Zusammenfassungen und Steuerungsanalyse zur Verfügung.
                  </p>
                </div>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
                    <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                  </svg>
                  Jetzt hochladen
                </Link>
              </div>
              <div className="grid divide-x divide-zinc-100 sm:grid-cols-3 dark:divide-zinc-800">
                {([
                  {
                    step: '1',
                    title: 'Metadaten einrichten',
                    desc: 'Dokumenttypen und Organisationseinheiten im Admin-Bereich anlegen.',
                    href: '/admin',
                    color: 'text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/40',
                  },
                  {
                    step: '2',
                    title: 'Dokument hochladen',
                    desc: 'PDF oder Word-Datei mit Metadaten in die Dokumentenbasis aufnehmen.',
                    href: '/upload',
                    color: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40',
                  },
                  {
                    step: '3',
                    title: 'KI nutzen',
                    desc: 'Fragen stellen, Zusammenfassungen abrufen und Steuerungsrelevanz analysieren.',
                    href: '/',
                    color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40',
                  },
                ] as const).map(({ step, title, desc, href, color }) => (
                  <Link key={step} href={href} className="flex flex-col gap-2 p-5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${color}`}>
                      {step}
                    </span>
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{title}</p>
                    <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{desc}</p>
                  </Link>
                ))}
              </div>
            </div>
          )
        )}

        {/* Tabellenansicht */}
        {!loading && !error && docs.length > 0 && viewMode === 'table' && (
          <DocumentTableView
            displayedDocs={displayedDocs}
            selectedSet={selectedSet}
            toggleSelectOne={toggleSelectOne}
            allSelected={allSelected}
            toggleSelectAll={toggleSelectAll}
            archiveView={archiveView}
            rowActionLoadingId={bulkActions.rowActionLoadingId}
            isBusy={bulkActions.isBusy}
            docTypeLabel={docTypeLabel}
            rowActions={rowActions}
            cycleSort={cycleSort}
            sortIndicator={sortIndicator}
          />
        )}

        {/* Kartenansicht */}
        {!loading && !error && docs.length > 0 && viewMode === 'cards' && (
          <DocumentCardsView
            displayedDocs={displayedDocs}
            selectedSet={selectedSet}
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
            selectedSet={selectedSet}
            toggleSelectOne={toggleSelectOne}
            archiveView={archiveView}
            rowActionLoadingId={bulkActions.rowActionLoadingId}
            isBusy={bulkActions.isBusy}
            docTypeLabel={docTypeLabel}
            rowActions={rowActions}
          />
        )}

        {!loading && !error && docs.length > 0 && (
          <DocumentListPagination
            page={listPageClamped}
            totalPages={listTotalPages}
            pageSize={DOCUMENT_LIST_PAGE_SIZE}
            totalItems={docs.length}
            onPageChange={setListPage}
          />
        )}

      </div>
    </main>
  );
}
