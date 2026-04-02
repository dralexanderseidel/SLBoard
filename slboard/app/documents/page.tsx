'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type DocumentListItem = {
  id: string;
  title: string;
  document_type_code: string;
  created_at: string;
  status: string;
  protection_class_id: number;
  gremium: string | null;
  responsible_unit: string;
  summary: string | null;
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkUpdateResult, setBulkUpdateResult] = useState<string | null>(null);
  const [bulkSummariesArmed, setBulkSummariesArmed] = useState(false);
  const [bulkSummarizing, setBulkSummarizing] = useState(false);
  const [bulkSummarizeResult, setBulkSummarizeResult] = useState<string | null>(null);
  const [editableSelectedIds, setEditableSelectedIds] = useState<string[]>([]);
  const [blockedSelectedIds, setBlockedSelectedIds] = useState<string[]>([]);
  const [bulkCapabilitiesLoading, setBulkCapabilitiesLoading] = useState(false);
  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loadSeqRef = useRef(0);
  const bulkCapabilitiesSeqRef = useRef(0);
  const [typeFilter, setTypeFilter] = useState<string>(''); // z.B. ELTERNBRIEF, KONZEPT ...
  const [statusFilters, setStatusFilters] = useState<string[]>([]); // ENTWURF, FREIGEGEBEN, VEROEFFENTLICHT (multi)
  const [protectionFilter, setProtectionFilter] = useState<string>(''); // "1", "2" oder leer
  const [searchInput, setSearchInput] = useState<string>(''); // aktueller Texteingabe-Wert
  const [searchQuery, setSearchQuery] = useState<string>(''); // tatsächlich angewendete Suche
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  type ViewMode = 'table' | 'cards' | 'compact';
  const [viewMode, setViewMode] = useState<ViewMode>('compact');

  type SortField = 'created_at' | 'title' | 'document_type_code' | 'status';
  type SortDir = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const load = async () => {
      const seq = ++loadSeqRef.current;
      const controller = new AbortController();
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilters.length > 0) params.set('status', statusFilters.join(','));
      if (protectionFilter) params.set('protectionClass', protectionFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const url = `/api/documents${params.toString() ? `?${params.toString()}` : ''}`;
      let res: Response;
      try {
        res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      } catch (e) {
        // Abgebrochen oder Netzwerkfehler
        if (controller.signal.aborted) return;
        throw e;
      }
      const json = (await res.json()) as { data?: DocumentListItem[]; error?: string };

      // Stale response ignorieren
      if (seq !== loadSeqRef.current) return;

      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Laden.');
        setDocs([]);
      } else {
        setDocs(json.data ?? []);
        setSelectedIds([]); // Selektion zurücksetzen bei Reload
      }

      setLoading(false);
      return () => controller.abort();
    };

    void load();
  }, [typeFilter, statusFilters, protectionFilter, searchQuery, reloadKey]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('documents_view_mode');
      if (stored === 'table' || stored === 'cards' || stored === 'compact') {
        setViewMode(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('documents_view_mode', viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  useEffect(() => {
    if (selectedIds.length <= 1) {
      setEditableSelectedIds([]);
      setBlockedSelectedIds([]);
      setBulkCapabilitiesLoading(false);
      return;
    }

    const run = async () => {
      const seq = ++bulkCapabilitiesSeqRef.current;
      setBulkCapabilitiesLoading(true);
      try {
        const res = await fetch('/api/documents/bulk-capabilities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds }),
        });
        const data = (await res.json()) as { editableIds?: string[]; blockedIds?: string[] };
        if (seq !== bulkCapabilitiesSeqRef.current) return;
        if (!res.ok) {
          setEditableSelectedIds([]);
          setBlockedSelectedIds([]);
          return;
        }
        setEditableSelectedIds(data.editableIds ?? []);
        setBlockedSelectedIds(data.blockedIds ?? []);
      } catch {
        if (seq !== bulkCapabilitiesSeqRef.current) return;
        setEditableSelectedIds([]);
        setBlockedSelectedIds([]);
      } finally {
        if (seq === bulkCapabilitiesSeqRef.current) setBulkCapabilitiesLoading(false);
      }
    };

    void run();
  }, [selectedIds]);

  const statusLabel = (s: string) => {
    if (s === 'ENTWURF') return 'Entwurf';
    if (s === 'FREIGEGEBEN') return 'Freigegeben';
    if (s === 'VEROEFFENTLICHT') return 'Veröffentlicht';
    return s;
  };

  const docTypeLabel = (code: string) => {
    if (code === 'PROTOKOLL') return 'Protokoll';
    if (code === 'BESCHLUSS') return 'Beschluss';
    if (code === 'KONZEPT') return 'Konzept';
    if (code === 'CURRICULUM') return 'Curriculum';
    if (code === 'VEREINBARUNG') return 'Vereinbarung';
    if (code === 'ELTERNBRIEF') return 'Elternbrief';
    if (code === 'RUNDSCHREIBEN') return 'Rundschreiben';
    if (code === 'SITUATIVE_REGELUNG') return 'Situative Regelung';
    return code;
  };

  const getWorkflowNext = (currentStatus: string) => {
    if (currentStatus === 'ENTWURF') return { next: 'FREIGEGEBEN', label: '→ Freigeben' };
    if (currentStatus === 'FREIGEGEBEN') return { next: 'VEROEFFENTLICHT', label: '→ Veröffentlichen' };
    return null;
  };

  const handleRowWorkflowStep = async (documentId: string, newStatus: string) => {
    if (rowActionLoadingId) return;
    if (bulkDeleting || bulkUpdating || bulkSummarizing) return;

    setRowActionLoadingId(documentId);
    setBulkDeleteResult(null);
    setBulkUpdateResult(null);
    setBulkSummarizeResult(null);

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Status konnte nicht geändert werden.');

      setSelectedIds([]);
      setReloadKey((k) => k + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Fehler beim Workflow-Schritt.');
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleRowDelete = async (documentId: string) => {
    if (rowActionLoadingId) return;
    if (bulkDeleting || bulkUpdating || bulkSummarizing) return;

    const title = docs.find((d) => d.id === documentId)?.title ?? documentId;
    const ok = window.confirm(`Dokument endgültig löschen?\n\n${title}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
    if (!ok) return;

    setRowActionLoadingId(documentId);
    setBulkDeleteResult(null);
    setBulkUpdateResult(null);
    setBulkSummarizeResult(null);

    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Löschen.');

      setSelectedIds([]);
      setReloadKey((k) => k + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Fehler beim Löschen.');
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const allVisibleIds = docs.map((d) => d.id);
  const allSelected = allVisibleIds.length > 0 && selectedIds.length === allVisibleIds.length;
  const noneSelected = selectedIds.length === 0;

  const displayedDocs = [...docs].sort((a, b) => {
    const dirMul = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'created_at') {
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dirMul;
    }
    if (sortField === 'title') {
      return a.title.localeCompare(b.title, 'de-DE') * dirMul;
    }
    if (sortField === 'document_type_code') {
      return a.document_type_code.localeCompare(b.document_type_code, 'de-DE') * dirMul;
    }
    if (sortField === 'status') {
      return a.status.localeCompare(b.status, 'de-DE') * dirMul;
    }
    return 0;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const createdDay = (iso: string) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const isToday = (iso: string) => createdDay(iso).getTime() === today.getTime();
  const isYesterday = (iso: string) =>
    createdDay(iso).getTime() === yesterday.getTime();

  const cycleSort = (field: SortField) => {
    if (field !== sortField) {
      setSortField(field);
      setSortDir('desc');
      return;
    }
    if (sortDir === 'desc') {
      setSortDir('asc');
      return;
    }
    // 3. Klick: Sortierung zurücksetzen (Default = created_at desc)
    setSortField('created_at');
    setSortDir('desc');
  };

  const sortIndicator = (field: SortField) => {
    if (field !== sortField) return null;
    return sortDir === 'asc' ? '↑' : '↓';
  };

  const STATUS_CHIPS: Array<{ value: string; label: string }> = [
    { value: 'ENTWURF', label: 'Entwurf' },
    { value: 'FREIGEGEBEN', label: 'Freigegeben' },
    { value: 'VEROEFFENTLICHT', label: 'Veröffentlicht' },
  ];

  const toggleStatusChip = (value: string) => {
    setStatusFilters((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const toggleSelectAll = () => {
    setBulkDeleteResult(null);
    setSelectedIds((prev) => (prev.length === allVisibleIds.length ? [] : [...allVisibleIds]));
  };

  const toggleSelectOne = (id: string) => {
    setBulkDeleteResult(null);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ids = editableSelectedIds.length > 0 ? [...editableSelectedIds] : [...selectedIds];
    if (ids.length === 0) return;
    setBulkUpdateResult(null);
    const confirmText =
      ids.length === 1
        ? (() => {
            const id = ids[0];
            const title = docs.find((d) => d.id === id)?.title ?? id;
            return `Dokument endgültig löschen?\n\n${title}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`;
          })()
        : `Ausgewählte Dokumente wirklich löschen?\n\nAnzahl: ${ids.length}\nDieser Vorgang kann nicht rückgängig gemacht werden.`;
    const ok = window.confirm(confirmText);
    if (!ok) return;

    setBulkDeleting(true);
    setBulkDeleteResult(null);
    try {
      // In-flight list reloads sollen nach dem Delete nicht "zurückspringen"
      loadSeqRef.current += 1;
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Fehler beim Löschen.');
          return true;
        })
      );

      const okCount = results.filter((r) => r.status === 'fulfilled').length;
      const failCount = results.length - okCount;
      const skippedCount = selectedIds.length - ids.length;
      const firstFailReason = results.find((r) => r.status === 'rejected');
      const failText =
        firstFailReason && firstFailReason.status === 'rejected'
          ? firstFailReason.reason instanceof Error
            ? firstFailReason.reason.message
            : String(firstFailReason.reason)
          : null;
      setBulkDeleteResult(
        failCount === 0
          ? `${okCount}/${results.length} Dokument(e) gelöscht${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.`
          : `${okCount}/${results.length} gelöscht, ${failCount} fehlgeschlagen${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.${failText ? ` Grund: ${failText}` : ''}`
      );

      // UI aktualisieren (ohne vollständigen Reload)
      setDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
      setSelectedIds([]);
      // Danach einmal serverseitig nachladen, um den finalen Zustand zu bestätigen
      setReloadKey((k) => k + 1);
    } catch (e) {
      setBulkDeleteResult(e instanceof Error ? e.message : 'Bulk-Löschen fehlgeschlagen.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkSetStatus = async (targetStatus: 'ENTWURF' | 'FREIGEGEBEN' | 'VEROEFFENTLICHT') => {
    if (selectedIds.length === 0) return;
    setBulkDeleteResult(null);
    setBulkUpdateResult(null);
    const ids = editableSelectedIds.length > 0 ? [...editableSelectedIds] : [...selectedIds];
    if (ids.length === 0) return;

    setBulkUpdating(true);
    try {
      // In-flight list reloads sollen nach Updates nicht "zurückspringen"
      loadSeqRef.current += 1;

      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/documents/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: targetStatus }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Fehler beim Statuswechsel.');
          return true;
        })
      );

      const okCount = results.filter((r) => r.status === 'fulfilled').length;
      const failCount = results.length - okCount;
      const skippedCount = selectedIds.length - ids.length;
      const firstFailReason = results.find((r) => r.status === 'rejected');
      const failText =
        firstFailReason && firstFailReason.status === 'rejected'
          ? firstFailReason.reason instanceof Error
            ? firstFailReason.reason.message
            : String(firstFailReason.reason)
          : null;
      setBulkUpdateResult(
        failCount === 0
          ? `${okCount}/${results.length} Dokument(e) aktualisiert (Status)${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.`
          : `${okCount}/${results.length} aktualisiert (Status), ${failCount} fehlgeschlagen${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.${failText ? ` Grund: ${failText}` : ''}`
      );

      setSelectedIds([]);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setBulkUpdateResult(e instanceof Error ? e.message : 'Bulk-Statuswechsel fehlgeschlagen.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkSetProtectionClass = async (targetClassId: 1 | 2 | 3) => {
    if (selectedIds.length === 0) return;
    setBulkDeleteResult(null);
    setBulkUpdateResult(null);
    const ids = editableSelectedIds.length > 0 ? [...editableSelectedIds] : [...selectedIds];
    if (ids.length === 0) return;

    setBulkUpdating(true);
    try {
      loadSeqRef.current += 1;

      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/documents/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ protection_class_id: targetClassId }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Fehler beim Schutzklassenwechsel.');
          return true;
        })
      );

      const okCount = results.filter((r) => r.status === 'fulfilled').length;
      const failCount = results.length - okCount;
      const skippedCount = selectedIds.length - ids.length;
      const firstFailReason = results.find((r) => r.status === 'rejected');
      const failText =
        firstFailReason && firstFailReason.status === 'rejected'
          ? firstFailReason.reason instanceof Error
            ? firstFailReason.reason.message
            : String(firstFailReason.reason)
          : null;
      setBulkUpdateResult(
        failCount === 0
          ? `${okCount}/${results.length} Dokument(e) aktualisiert (Schutzklasse)${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.`
          : `${okCount}/${results.length} aktualisiert (Schutzklasse), ${failCount} fehlgeschlagen${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.${failText ? ` Grund: ${failText}` : ''}`
      );

      setSelectedIds([]);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setBulkUpdateResult(e instanceof Error ? e.message : 'Bulk-Schutzklassenwechsel fehlgeschlagen.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkGenerateSummaries = async () => {
    if (selectedIds.length === 0) return;
    if (!bulkSummariesArmed) return;
    const ids = editableSelectedIds.length > 0 ? [...editableSelectedIds] : [...selectedIds];
    if (ids.length === 0) return;

    const ok = window.confirm(
      `KI-Zusammenfassung für ${ids.length} Dokument(e) erzeugen?\n\nDas kann je nach Dokumentenlänge dauern.`
    );
    if (!ok) return;

    setBulkDeleteResult(null);
    setBulkUpdateResult(null);
    setBulkSummarizeResult(null);

    setBulkSummarizing(true);
    try {
      loadSeqRef.current += 1;

      const res = await fetch('/api/summarize-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: ids }),
      });
      const data = (await res.json()) as {
        okCount?: number;
        failCount?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Erzeugen der Zusammenfassungen.');

      const okCount = data.okCount ?? 0;
      const failCount = data.failCount ?? (ids.length - okCount);
      const skippedCount = selectedIds.length - ids.length;
      setBulkSummarizeResult(
        failCount === 0
          ? `${okCount}/${ids.length} Dokument(e) aktualisiert (Zusammenfassung)${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.`
          : `${okCount}/${ids.length} aktualisiert (Zusammenfassung), ${failCount} fehlgeschlagen${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.`
      );

      setBulkSummariesArmed(false);
      setSelectedIds([]);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setBulkSummarizeResult(e instanceof Error ? e.message : 'Bulk-Zusammenfassung fehlgeschlagen.');
    } finally {
      setBulkSummarizing(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-3 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold">Dokumente</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Liste der in der Dokumentenbasis gespeicherten schulischen Dokumente.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Link
              href="/upload"
              className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              Dokumente hochladen
            </Link>
            <Link
              href="/"
              className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
            >
              ← Zur Startseite
            </Link>
          </div>
        </header>

        {/* Suchfeld + Filterleiste */}
        <section className="flex flex-wrap items-end gap-4">
          <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Suche
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setSearchQuery(searchInput.trim());
                  }
                }}
                placeholder="z. B. Handynutzung, Medienwoche, Schulkonferenz…"
                className="h-8 w-full rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => setSearchQuery(searchInput.trim())}
                className="h-8 rounded bg-blue-600 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                Suchen
              </button>
            </div>
            {searchQuery && (
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Aktuelle Suche: <span className="font-medium">{searchQuery}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Dokumenttyp
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Alle</option>
              <option value="PROTOKOLL">Protokoll</option>
              <option value="BESCHLUSS">Beschluss</option>
              <option value="KONZEPT">Konzept</option>
              <option value="CURRICULUM">Curriculum</option>
              <option value="VEREINBARUNG">Vereinbarung</option>
              <option value="ELTERNBRIEF">Elternbrief</option>
              <option value="RUNDSCHREIBEN">Rundschreiben</option>
              <option value="SITUATIVE_REGELUNG">Situative Regelung</option>
            </select>
          </div>

        </section>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((v) => !v)}
            className="h-8 rounded border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
          >
            Erweiterte Filter {showAdvancedFilters ? 'einklappen' : 'ausklappen'}
          </button>

          <button
            type="button"
            onClick={() => {
              setTypeFilter('');
              setStatusFilters([]);
              setProtectionFilter('');
              setSearchInput('');
              setSearchQuery('');
            }}
            className="h-8 rounded border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
          >
            Filter zurücksetzen
          </button>
        </div>

        {showAdvancedFilters && (
          <section className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1 min-w-[240px] flex-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Status (Mehrfachauswahl)
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_CHIPS.map((chip) => {
                    const active = statusFilters.includes(chip.value);
                    return (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => toggleStatusChip(chip.value)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                          active
                            ? 'border-blue-300 bg-blue-50 text-zinc-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50'
                            : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Schutzklasse
                </label>
                <select
                  value={protectionFilter}
                  onChange={(e) => setProtectionFilter(e.target.value)}
                  className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Alle</option>
                  <option value="1">1 – Öffentlich / unkritisch</option>
                  <option value="2">2 – Verwaltung/Sekretariat + Schulleitung</option>
                  <option value="3">3 – Nur Schulleitung</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Ergebnis-Hinweis (bleibt sichtbar auch wenn Auswahl zurückgesetzt wird) */}
        {!loading && !error && (bulkDeleteResult || bulkUpdateResult || bulkSummarizeResult) && (
          <section className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-zinc-600 dark:text-zinc-300">
              {bulkDeleteResult ?? bulkUpdateResult ?? bulkSummarizeResult}
            </span>
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
                  onChange={() => {
                    setBulkDeleteResult(null);
                    setBulkUpdateResult(null);
                    setBulkSummarizeResult(null);
                    setSelectedIds([...allVisibleIds]);
                  }}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-zinc-700 dark:text-zinc-200">Alle</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={noneSelected}
                  onChange={() => {
                    setBulkDeleteResult(null);
                    setBulkUpdateResult(null);
                    setBulkSummarizeResult(null);
                    setSelectedIds([]);
                  }}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-zinc-700 dark:text-zinc-200">Keine</span>
              </label>
            </div>
            <span className="text-zinc-600 dark:text-zinc-300">
              Ausgewählt: <span className="font-semibold">{selectedIds.length}</span>
            </span>
          </section>
        )}

        {/* Bulk-Aktionen: nur bei Mehrfachauswahl */}
        {!loading && !error && docs.length > 0 && selectedIds.length > 1 && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-1 items-center gap-3 flex-wrap">
              <span className="text-zinc-600 dark:text-zinc-300">
                Ausgewählt: <span className="font-semibold">{selectedIds.length}</span>
              </span>
              {bulkCapabilitiesLoading ? (
                <span className="text-zinc-500 dark:text-zinc-400">Prüfe Berechtigungen…</span>
              ) : (
                <span className="text-zinc-600 dark:text-zinc-300">
                  Änderbar: <span className="font-semibold">{editableSelectedIds.length}</span>
                  {blockedSelectedIds.length > 0 && (
                    <>
                      {' · '}
                      Nicht änderbar: <span className="font-semibold">{blockedSelectedIds.length}</span>
                    </>
                  )}
                </span>
              )}
            </div>

            {!bulkCapabilitiesLoading && blockedSelectedIds.length > 0 && (
              <p className="w-full rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                Hinweis: Ein Teil der Auswahl ist nicht änderbar (z. B. wegen Rolle/Verantwortlich/Schutzklasse).
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={
                  selectedIds.length === 0 ||
                  bulkCapabilitiesLoading ||
                  editableSelectedIds.length === 0 ||
                  bulkDeleting ||
                  bulkUpdating ||
                  bulkSummarizing
                }
                className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
              >
                {bulkDeleting ? 'Lösche…' : 'Ausgewählte löschen'}
              </button>

              <span className="mx-1 h-5 border-l border-zinc-200 dark:border-zinc-800" />

              <button
                type="button"
                onClick={() => void handleBulkSetStatus('ENTWURF')}
                disabled={
                  selectedIds.length === 0 ||
                  bulkCapabilitiesLoading ||
                  editableSelectedIds.length === 0 ||
                  bulkDeleting ||
                  bulkUpdating ||
                  bulkSummarizing
                }
                className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
              >
                {bulkUpdating ? '…' : 'Status -> Entwurf'}
              </button>
              <button
                type="button"
                onClick={() => void handleBulkSetStatus('FREIGEGEBEN')}
                disabled={
                  selectedIds.length === 0 ||
                  bulkCapabilitiesLoading ||
                  editableSelectedIds.length === 0 ||
                  bulkDeleting ||
                  bulkUpdating ||
                  bulkSummarizing
                }
                className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
              >
                {bulkUpdating ? '…' : 'Status -> Freigegeben'}
              </button>
              <button
                type="button"
                onClick={() => void handleBulkSetStatus('VEROEFFENTLICHT')}
                disabled={
                  selectedIds.length === 0 ||
                  bulkCapabilitiesLoading ||
                  editableSelectedIds.length === 0 ||
                  bulkDeleting ||
                  bulkUpdating ||
                  bulkSummarizing
                }
                className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
              >
                {bulkUpdating ? '…' : 'Status -> Veröffentlicht'}
              </button>

              <span className="mx-1 h-5 border-l border-zinc-200 dark:border-zinc-800" />

              <button
                type="button"
                onClick={() => void handleBulkSetProtectionClass(1)}
                disabled={
                  selectedIds.length === 0 ||
                  bulkCapabilitiesLoading ||
                  editableSelectedIds.length === 0 ||
                  bulkDeleting ||
                  bulkUpdating ||
                  bulkSummarizing
                }
                className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
              >
                {bulkUpdating ? '…' : 'Schutzklasse -> 1'}
              </button>
              <button
                type="button"
                onClick={() => void handleBulkSetProtectionClass(2)}
                disabled={
                  selectedIds.length === 0 ||
                  bulkCapabilitiesLoading ||
                  editableSelectedIds.length === 0 ||
                  bulkDeleting ||
                  bulkUpdating ||
                  bulkSummarizing
                }
                className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
              >
                {bulkUpdating ? '…' : 'Schutzklasse -> 2'}
              </button>
              <button
                type="button"
                onClick={() => void handleBulkSetProtectionClass(3)}
                disabled={
                  selectedIds.length === 0 ||
                  bulkCapabilitiesLoading ||
                  editableSelectedIds.length === 0 ||
                  bulkDeleting ||
                  bulkUpdating ||
                  bulkSummarizing
                }
                className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
              >
                {bulkUpdating ? '…' : 'Schutzklasse -> 3'}
              </button>

              <span className="mx-1 h-5 border-l border-zinc-200 dark:border-zinc-800" />

              <label className="inline-flex cursor-pointer items-center gap-2 text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={bulkSummariesArmed}
                  onChange={(e) => setBulkSummariesArmed(e.target.checked)}
                  disabled={
                    selectedIds.length === 0 ||
                    bulkCapabilitiesLoading ||
                    editableSelectedIds.length === 0 ||
                    bulkDeleting ||
                    bulkUpdating ||
                    bulkSummarizing
                  }
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-zinc-600"
                />
                <span className="text-[11px] font-medium">KI-Zusammenfassung (Batch)</span>
              </label>

              <button
                type="button"
                onClick={() => void handleBulkGenerateSummaries()}
                disabled={
                  selectedIds.length === 0 ||
                  bulkCapabilitiesLoading ||
                  editableSelectedIds.length === 0 ||
                  !bulkSummariesArmed ||
                  bulkDeleting ||
                  bulkUpdating ||
                  bulkSummarizing
                }
                className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
              >
                {bulkSummarizing ? 'KI fasst zusammen…' : 'Zusammenfassung für ausgewählte Dokumente erzeugen'}
              </button>
            </div>
          </section>
        )}

        {!loading && !error && docs.length > 0 && (
          <section className="flex items-center justify-end">
            <div className="inline-flex rounded border border-zinc-300 bg-white p-0.5 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`rounded px-2 py-1 font-medium transition ${
                  viewMode === 'table'
                    ? 'bg-blue-50 text-zinc-900 dark:bg-blue-950/40 dark:text-zinc-50'
                    : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                Tabelle
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`rounded px-2 py-1 font-medium transition ${
                  viewMode === 'cards'
                    ? 'bg-blue-50 text-zinc-900 dark:bg-blue-950/40 dark:text-zinc-50'
                    : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                Karten
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className={`rounded px-2 py-1 font-medium transition ${
                  viewMode === 'compact'
                    ? 'bg-blue-50 text-zinc-900 dark:bg-blue-950/40 dark:text-zinc-50'
                    : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                Kompakt
              </button>
            </div>
          </section>
        )}

        {loading && (
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-zinc-200 bg-white text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-zinc-100 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <div className="h-4 w-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <div className="h-3.5 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <div className="h-3.5 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <div className="h-3.5 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <div className="h-3.5 w-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <div className="h-3.5 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <div className="h-3.5 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="border-t border-zinc-200 odd:bg-white even:bg-zinc-50 dark:border-zinc-800 dark:odd:bg-zinc-900 dark:even:bg-zinc-950/30">
                    <td className="px-3 py-2">
                      <div className="h-4 w-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-3.5 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-3.5 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-3.5 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                      <div className="mt-2 h-2.5 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-3.5 w-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-3.5 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && (
          <p className="text-sm text-red-600">
            Fehler beim Laden der Dokumente: {error}
          </p>
        )}

        {!loading && !error && docs.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Es wurden noch keine Dokumente gefunden.
          </p>
        )}

        {!loading && !error && docs.length > 0 && viewMode === 'table' && (
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-zinc-200 bg-white text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-zinc-100 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Alle auswählen"
                    />
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => cycleSort('title')}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      Titel
                      {sortIndicator('title') && (
                        <span className="text-[11px] text-zinc-500">{sortIndicator('title')}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <span>{/* Sortierung für Typ ist optional */} </span>
                    <button
                      type="button"
                      onClick={() => cycleSort('document_type_code')}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      Typ
                      {sortIndicator('document_type_code') && (
                        <span className="text-[11px] text-zinc-500">
                          {sortIndicator('document_type_code')}
                        </span>
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => cycleSort('status')}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      Status
                      {sortIndicator('status') && (
                        <span className="text-[11px] text-zinc-500">{sortIndicator('status')}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => cycleSort('created_at')}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      Erstellt am
                      {sortIndicator('created_at') && (
                        <span className="text-[11px] text-zinc-500">{sortIndicator('created_at')}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left">KI-Zusammenfassung vorhanden</th>
                  <th className="px-3 py-2 text-left">Beschlussgremium</th>
                  <th className="px-3 py-2 text-left">Verantwortlich</th>
                  <th className="px-3 py-2 text-left">Schutzklasse</th>
                </tr>
              </thead>
              <tbody>
                {displayedDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`border-t border-zinc-200 odd:bg-white even:bg-zinc-50 dark:border-zinc-800 dark:odd:bg-zinc-900 dark:even:bg-zinc-950 ${
                      isToday(doc.created_at)
                        ? 'bg-blue-50 dark:bg-zinc-900/30'
                        : isYesterday(doc.created_at)
                          ? 'bg-blue-50/40 dark:bg-zinc-900/20'
                          : ''
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc.id)}
                        onChange={() => toggleSelectOne(doc.id)}
                        aria-label={`Dokument auswählen: ${doc.title}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="min-w-0 flex-1 truncate text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                        >
                          {doc.title}
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleRowDelete(doc.id)}
                          disabled={rowActionLoadingId === doc.id || bulkDeleting || bulkUpdating || bulkSummarizing}
                          className="inline-flex items-center justify-center rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">{docTypeLabel(doc.document_type_code)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          {statusLabel(doc.status)}
                        </span>
                        {getWorkflowNext(doc.status) && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleRowWorkflowStep(doc.id, getWorkflowNext(doc.status)!.next)
                            }
                            disabled={
                              rowActionLoadingId === doc.id ||
                              bulkDeleting ||
                              bulkUpdating ||
                              bulkSummarizing
                            }
                            className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
                          >
                            {getWorkflowNext(doc.status)!.label}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span>
                        {new Date(doc.created_at).toLocaleDateString('de-DE')}
                      </span>
                      {isToday(doc.created_at) && (
                        <span className="ml-2 inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                          Neu
                        </span>
                      )}
                      {isYesterday(doc.created_at) && !isToday(doc.created_at) && (
                        <span className="ml-2 inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
                          Gestern
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {doc.summary && doc.summary.trim().length > 0 ? (
                        <Link
                          href={`/documents/${doc.id}?focus=summary`}
                          aria-label="Zur Zusammenfassung springen"
                          className="inline-flex items-center justify-center rounded border border-blue-200 bg-blue-50 p-1 text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M20 6L9 17L4 12"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </Link>
                      ) : (
                        <Link
                          href={`/documents/${doc.id}?focus=summary`}
                          aria-label="Zur Zusammenfassung springen (noch nicht vorhanden)"
                          className="inline-flex items-center justify-center rounded border border-zinc-200 bg-white p-1 text-zinc-400 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600 dark:hover:bg-zinc-800"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M12 8V12L15 15"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          </svg>
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-2">{doc.gremium ?? '—'}</td>
                    <td className="px-3 py-2">{doc.responsible_unit}</td>
                    <td className="px-3 py-2">{doc.protection_class_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && docs.length > 0 && viewMode === 'cards' && (
          <section className="grid gap-3 md:grid-cols-2">
            {displayedDocs.map((doc) => (
              <article
                key={doc.id}
                className={`rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:shadow dark:border-zinc-800 dark:bg-zinc-900 ${
                  isToday(doc.created_at)
                    ? 'ring-1 ring-blue-200 dark:ring-blue-900/40'
                    : isYesterday(doc.created_at)
                      ? 'ring-1 ring-zinc-200 dark:ring-zinc-700'
                      : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(doc.id)}
                      onChange={() => toggleSelectOne(doc.id)}
                      aria-label={`Dokument auswählen: ${doc.title}`}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="block truncate text-sm font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
                      >
                        {doc.title}
                      </Link>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRowDelete(doc.id)}
                    disabled={rowActionLoadingId === doc.id || bulkDeleting || bulkUpdating || bulkSummarizing}
                    className="inline-flex items-center justify-center rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
                  >
                    Löschen
                  </button>
                </div>

                <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                  {docTypeLabel(doc.document_type_code)} · {doc.responsible_unit}
                  {doc.gremium ? ` · ${doc.gremium}` : ''}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      doc.status === 'ENTWURF'
                        ? 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                        : doc.status === 'FREIGEGEBEN'
                          ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200'
                    }`}
                  >
                    {statusLabel(doc.status)}
                  </span>
                  {getWorkflowNext(doc.status) && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleRowWorkflowStep(doc.id, getWorkflowNext(doc.status)!.next)
                      }
                      disabled={
                        rowActionLoadingId === doc.id || bulkDeleting || bulkUpdating || bulkSummarizing
                      }
                      className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
                    >
                      {getWorkflowNext(doc.status)!.label}
                    </button>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {new Date(doc.created_at).toLocaleDateString('de-DE')}
                  </span>
                  {isToday(doc.created_at) && (
                    <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                      Neu
                    </span>
                  )}
                  {isYesterday(doc.created_at) && !isToday(doc.created_at) && (
                    <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
                      Gestern
                    </span>
                  )}
                  <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    Schutzklasse {doc.protection_class_id}
                  </span>

                  <Link
                    href={`/documents/${doc.id}?focus=summary`}
                    aria-label="Zur Zusammenfassung springen"
                    title={
                      doc.summary && doc.summary.trim().length > 0
                        ? 'KI-Zusammenfassung vorhanden'
                        : 'Noch keine KI-Zusammenfassung'
                    }
                    className={`inline-flex items-center justify-center rounded border p-1 transition ${
                      doc.summary && doc.summary.trim().length > 0
                        ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950'
                        : 'border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {doc.summary && doc.summary.trim().length > 0 ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}

        {!loading && !error && docs.length > 0 && viewMode === 'compact' && (
          <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {displayedDocs.map((doc) => (
                <li key={doc.id} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(doc.id)}
                        onChange={() => toggleSelectOne(doc.id)}
                        aria-label={`Dokument auswählen: ${doc.title}`}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="block truncate text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
                        >
                          {doc.title}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                          {docTypeLabel(doc.document_type_code)} · {doc.responsible_unit}
                          {doc.gremium ? ` · ${doc.gremium}` : ''}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                              doc.status === 'ENTWURF'
                                ? 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                                : doc.status === 'FREIGEGEBEN'
                                  ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200'
                            }`}
                          >
                            {statusLabel(doc.status)}
                          </span>
                          <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            {new Date(doc.created_at).toLocaleDateString('de-DE')}
                          </span>
                          <span className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            SK {doc.protection_class_id}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {getWorkflowNext(doc.status) && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleRowWorkflowStep(doc.id, getWorkflowNext(doc.status)!.next)
                          }
                          disabled={
                            rowActionLoadingId === doc.id || bulkDeleting || bulkUpdating || bulkSummarizing
                          }
                          className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[10px] font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
                        >
                          {getWorkflowNext(doc.status)!.label}
                        </button>
                      )}
                      <Link
                        href={`/documents/${doc.id}?focus=summary`}
                        aria-label="Zur Zusammenfassung springen"
                        className={`inline-flex items-center justify-center rounded border p-1 transition ${
                          doc.summary && doc.summary.trim().length > 0
                            ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950'
                            : 'border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {doc.summary && doc.summary.trim().length > 0 ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        )}
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleRowDelete(doc.id)}
                        disabled={rowActionLoadingId === doc.id || bulkDeleting || bulkUpdating || bulkSummarizing}
                        className="inline-flex items-center justify-center rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

