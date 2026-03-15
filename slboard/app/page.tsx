'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

type RecentQuery = {
  id: number;
  question: string;
  created_at: string;
};

type QuerySource = {
  documentId: string;
  title: string;
  snippet: string;
};

export default function Home() {
  const [question, setQuestion] = useState('');
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryAnswer, setQueryAnswer] = useState<string | null>(null);
  const [querySources, setQuerySources] = useState<QuerySource[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecent = async () => {
      const { data } = await supabase
        .from('ai_queries')
        .select('id, question, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentQueries(data ?? []);
    };

    void loadRecent();
  }, []);

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setQueryError(null);
    setQueryAnswer(null);
    setQuerySources([]);
    setQueryLoading(true);
    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'KI-Anfrage fehlgeschlagen.');
      setQueryAnswer(data.answer);
      setQuerySources(data.sources ?? []);
      setRecentQueries((prev) => [
        { id: Date.now(), question: trimmed, created_at: new Date().toISOString() },
        ...prev.filter((q) => q.question !== trimmed).slice(0, 4),
      ]);
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : 'Fehler bei der KI-Anfrage.');
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <h1 className="text-2xl font-semibold">Schulische Dokumentenverwaltung</h1>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Zentrale Ablage, Suche und KI-Assistenz für schulische Dokumente (Elternbriefe,
            Konzepte, Protokolle, Beschlüsse).
          </p>
        </header>

        {/* Fragefeld wie im Dashboard-Mockup */}
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Was gilt bei uns zu diesem Thema?
          </h2>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="z. B. Handynutzung in Pausen, Medienwoche, Leistungsbewertung Oberstufe…"
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              />
            </div>
            <button
              type="button"
              onClick={handleAsk}
              className="h-10 rounded bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              disabled={!question.trim() || queryLoading}
            >
              {queryLoading ? 'KI sucht…' : 'KI fragen'}
            </button>
          </div>

          {queryError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{queryError}</p>
          )}
          {queryAnswer && (
            <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-950">
              <h3 className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Antwort
              </h3>
              <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                {queryAnswer}
              </p>
              {querySources.length > 0 && (
                <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                  <h4 className="mb-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    Verwendete Dokumente
                  </h4>
                  <ul className="space-y-1">
                    {querySources.map((s) => (
                      <li key={s.documentId}>
                        <Link
                          href={`/documents/${s.documentId}`}
                          className="text-xs text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                        >
                          {s.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/documents${question.trim() ? `?query=${encodeURIComponent(question.trim())}` : ''}`}
              className="inline-flex items-center gap-2 rounded bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              In Dokumenten suchen
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-800 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              Dokument hochladen
            </Link>
            <Link
              href="/drafts"
              className="inline-flex items-center gap-2 rounded border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
            >
              Neuen Entwurf erstellen
            </Link>
          </div>
        </section>

        {/* Aktuelle Anfragen */}
        <section className="mt-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Aktuelle Anfragen
          </h2>
          {recentQueries.length === 0 ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Noch keine gespeicherten Anfragen. Die letzten Fragen an die KI werden hier später
              angezeigt.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800">
              {recentQueries.map((q) => (
                <li key={q.id} className="flex items-center justify-between py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuestion(q.question);
                      setQueryAnswer(null);
                      setQuerySources([]);
                      setQueryError(null);
                    }}
                    className="text-left text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  >
                    {q.question}
                  </button>
                  <span className="whitespace-nowrap pl-3 text-[11px] text-zinc-500">
                    {new Date(q.created_at).toLocaleDateString('de-DE')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
