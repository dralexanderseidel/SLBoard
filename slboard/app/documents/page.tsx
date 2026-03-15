'use client';

import React, { useEffect, useState } from 'react';
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
  const [typeFilter, setTypeFilter] = useState<string>(''); // z.B. ELTERNBRIEF, KONZEPT ...
  const [statusFilter, setStatusFilter] = useState<string>(''); // ENTWURF, FREIGEGEBEN, VEROEFFENTLICHT
  const [protectionFilter, setProtectionFilter] = useState<string>(''); // "1", "2" oder leer
  const [searchInput, setSearchInput] = useState<string>(''); // aktueller Texteingabe-Wert
  const [searchQuery, setSearchQuery] = useState<string>(''); // tatsächlich angewendete Suche

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (protectionFilter) params.set('protectionClass', protectionFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const url = `/api/documents${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      const json = (await res.json()) as { data?: DocumentListItem[]; error?: string };

      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Laden.');
        setDocs([]);
      } else {
        setDocs(json.data ?? []);
      }

      setLoading(false);
    };

    void load();
  }, [typeFilter, statusFilter, protectionFilter, searchQuery]);

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

