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
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loadSeqRef = useRef(0);
  const [typeFilter, setTypeFilter] = useState<string>(''); // z.B. ELTERNBRIEF, KONZEPT ...
  const [statusFilter, setStatusFilter] = useState<string>(''); // ENTWURF, FREIGEGEBEN, VEROEFFENTLICHT
  const [protectionFilter, setProtectionFilter] = useState<string>(''); // "1", "2" oder leer
  const [searchInput, setSearchInput] = useState<string>(''); // aktueller Texteingabe-Wert
  const [searchQuery, setSearchQuery] = useState<string>(''); // tatsächlich angewendete Suche

  useEffect(() => {
    const load = async () => {
      const seq = ++loadSeqRef.current;
      const controller = new AbortController();
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
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
  }, [typeFilter, statusFilter, protectionFilter, searchQuery, reloadKey]);

  const allVisibleIds = docs.map((d) => d.id);
  const allSelected = allVisibleIds.length > 0 && selectedIds.length === allVisibleIds.length;

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
    const confirmText =
      selectedIds.length === 1
        ? (() => {
            const id = selectedIds[0];
            const title = docs.find((d) => d.id === id)?.title ?? id;
            return `Dokument endgültig löschen?\n\n${title}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`;
          })()
        : `Ausgewählte Dokumente wirklich löschen?\n\nAnzahl: ${selectedIds.length}\nDieser Vorgang kann nicht rückgängig gemacht werden.`;
    const ok = window.confirm(confirmText);
    if (!ok) return;

    setBulkDeleting(true);
    setBulkDeleteResult(null);
    try {
      // In-flight list reloads sollen nach dem Delete nicht "zurückspringen"
      loadSeqRef.current += 1;
      const results = await Promise.allSettled(
        selectedIds.map(async (id) => {
          const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Fehler beim Löschen.');
          return true;
        })
      );

      const okCount = results.filter((r) => r.status === 'fulfilled').length;
      const failCount = results.length - okCount;
      setBulkDeleteResult(
        failCount === 0
          ? `${okCount}/${results.length} Dokument(e) gelöscht.`
          : `${okCount}/${results.length} gelöscht, ${failCount} fehlgeschlagen.`
      );

      // UI aktualisieren (ohne vollständigen Reload)
      setDocs((prev) => prev.filter((d) => !selectedIds.includes(d.id)));
      setSelectedIds([]);
      // Danach einmal serverseitig nachladen, um den finalen Zustand zu bestätigen
      setReloadKey((k) => k + 1);
    } catch (e) {
      setBulkDeleteResult(e instanceof Error ? e.message : 'Bulk-Löschen fehlgeschlagen.');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold">Dokumente</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Liste der in Supabase gespeicherten schulischen Dokumente.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            ← Zur Startseite
          </Link>
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
              <option value="ELTERNBRIEF">Elternbrief</option>
              <option value="KONZEPT">Konzept</option>
              <option value="PROTOKOLL">Protokoll</option>
              <option value="RUNDSCHREIBEN">Rundschreiben</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Alle</option>
              <option value="ENTWURF">Entwurf</option>
              <option value="FREIGEGEBEN">Freigegeben</option>
              <option value="VEROEFFENTLICHT">Veröffentlicht</option>
            </select>
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
              <option value="2">2 – Intern</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setTypeFilter('');
              setStatusFilter('');
              setProtectionFilter('');
              setSearchInput('');
              setSearchQuery('');
            }}
            className="h-8 rounded border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
          >
            Filter zurücksetzen
          </button>
        </section>

        {/* Bulk-Aktionen */}
        {!loading && !error && docs.length > 0 && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <span className="text-zinc-600 dark:text-zinc-300">
                Ausgewählt: <span className="font-semibold">{selectedIds.length}</span>
              </span>
              {bulkDeleteResult && (
                <span className="text-zinc-600 dark:text-zinc-300">{bulkDeleteResult}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={selectedIds.length === 0 || bulkDeleting}
              className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
            >
              {bulkDeleting ? 'Lösche…' : 'Ausgewählte löschen'}
            </button>
          </section>
        )}

        {loading && <p className="text-sm text-zinc-600 dark:text-zinc-400">Lade Dokumente…</p>}
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

        {!loading && !error && docs.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full border-collapse">
              <thead className="bg-zinc-100 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Alle auswählen"
                    />
                  </th>
                  <th className="px-3 py-2 text-left">Titel</th>
                  <th className="px-3 py-2 text-left">Typ</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Schutzklasse</th>
                  <th className="px-3 py-2 text-left">Gremium</th>
                  <th className="px-3 py-2 text-left">Organisationseinheit</th>
                  <th className="px-3 py-2 text-left">Erstellt am</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-t border-zinc-200 odd:bg-white even:bg-zinc-50 dark:border-zinc-800 dark:odd:bg-zinc-900 dark:even:bg-zinc-950"
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
                      <Link
                        href={`/documents/${doc.id}`}
                        className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                      >
                        {doc.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{doc.document_type_code}</td>
                    <td className="px-3 py-2">{doc.status}</td>
                    <td className="px-3 py-2">{doc.protection_class_id}</td>
                    <td className="px-3 py-2">{doc.gremium ?? '—'}</td>
                    <td className="px-3 py-2">{doc.responsible_unit}</td>
                    <td className="px-3 py-2">
                      {new Date(doc.created_at).toLocaleDateString('de-DE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

