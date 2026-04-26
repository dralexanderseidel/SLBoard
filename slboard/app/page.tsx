'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

type RecentQuery = {
  id: number | string;
  question: string;
  created_at: string;
  answer_excerpt?: string | null;
  sources?: unknown;
};

type QuerySource = {
  documentId: string;
  title: string;
  snippet: string;
};

type RecentlyPublished = {
  documentId: string;
  title: string;
  publishedAt: string;
};

type ReviewOverdue = {
  documentId: string;
  title: string;
  reviewDate: string;
  responsibleUnit: string | null;
};

type SuggestedDoc = {
  id: string;
  title: string;
  snippet: string;
  score: number;
};

function normalizeQuerySources(raw: unknown): QuerySource[] {
  if (!Array.isArray(raw)) return [];
  const out: QuerySource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const documentId = typeof o.documentId === 'string' ? o.documentId : '';
    if (!documentId) continue;
    out.push({
      documentId,
      title: typeof o.title === 'string' ? o.title : '',
      snippet: typeof o.snippet === 'string' ? o.snippet : '',
    });
  }
  return out;
}

export default function Home() {
  const [question, setQuestion] = useState('');
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [recentlyPublished, setRecentlyPublished] = useState<RecentlyPublished[]>([]);
  const [reviewOverdue, setReviewOverdue] = useState<ReviewOverdue[]>([]);
  const [publishedLoading, setPublishedLoading] = useState(true);
  const [reviewOverdueLoading, setReviewOverdueLoading] = useState(true);
  const [publishedLoadError, setPublishedLoadError] = useState<string | null>(null);
  const [reviewOverdueLoadError, setReviewOverdueLoadError] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryAnswer, setQueryAnswer] = useState<string | null>(null);
  const [querySources, setQuerySources] = useState<QuerySource[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestedDocuments, setSuggestedDocuments] = useState<SuggestedDoc[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [onboardingDismissed, setOnboardingDismissed] = useState(true);
  const dashboardAiGenRef = useRef(0);

  // Show onboarding when all notification sections are empty (likely a new school).
  // Dismissed state is persisted in localStorage to avoid repeated display.
  useEffect(() => {
    try {
      if (!localStorage.getItem('onboarding_dismissed')) {
        setOnboardingDismissed(false);
      }
    } catch { /* localStorage not available */ }
  }, []);

  useEffect(() => {
    if (!question.trim()) {
      dashboardAiGenRef.current += 1;
      setQueryAnswer(null);
      setQuerySources([]);
      setQueryError(null);
      setQueryLoading(false);
      setSuggestLoading(false);
      setSuggestedDocuments([]);
      setSelectedDocumentIds([]);
    }
  }, [question]);

  const daysDiffFromToday = (isoDateOrTs: string) => {
    const d = new Date(isoDateOrTs);
    const today = new Date();
    const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return Math.floor((d0 - t0) / (24 * 60 * 60 * 1000));
  };

  const relativeDayLabel = (isoDateOrTs: string) => {
    const diff = daysDiffFromToday(isoDateOrTs);
    if (diff === 0) return 'Heute';
    if (diff === -1) return 'Gestern';
    if (diff === 1) return 'Morgen';
    return null;
  };

  const overdueBadge = (reviewDate: string) => {
    const diff = daysDiffFromToday(`${reviewDate}T00:00:00`);
    const overdueDays = Math.max(0, -diff);
    if (overdueDays === 0) return 'Heute fällig';
    if (overdueDays === 1) return '1 Tag überfällig';
    return `${overdueDays} Tage überfällig`;
  };

  const refreshRecentQueries = useCallback(async () => {
    const { data } = await supabase
      .from('ai_queries')
      .select('id, question, created_at, answer_text, sources')
      .order('created_at', { ascending: false })
      .limit(5);

    setRecentQueries((data ?? []) as RecentQuery[]);
  }, []);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await fetch('/api/notifications');
        const json = (await res.json()) as {
          recentlyPublished?: RecentlyPublished[];
          reviewOverdue?: ReviewOverdue[];
        };
        setRecentlyPublished(json.recentlyPublished ?? []);
        setReviewOverdue(json.reviewOverdue ?? []);
      } catch {
        setPublishedLoadError('Benachrichtigungen konnten nicht geladen werden.');
        setReviewOverdueLoadError('Benachrichtigungen konnten nicht geladen werden.');
      } finally {
        setPublishedLoading(false);
        setReviewOverdueLoading(false);
      }
    };

    void Promise.all([refreshRecentQueries(), loadNotifications()]);
  }, [refreshRecentQueries]);

  const handleSuggestDocuments = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const requestGen = ++dashboardAiGenRef.current;
    setQueryError(null);
    setQueryAnswer(null);
    setQuerySources([]);
    setSuggestedDocuments([]);
    setSuggestLoading(true);
    try {
      const res = await fetch('/api/ai/suggest-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Suche fehlgeschlagen.');
      if (requestGen !== dashboardAiGenRef.current) return;
      const list = data.suggestedDocuments ?? [];
      setSuggestedDocuments(list);
      setSelectedDocumentIds(list.map((d: SuggestedDoc) => d.id));
    } catch (err: unknown) {
      if (requestGen !== dashboardAiGenRef.current) return;
      setQueryError(err instanceof Error ? err.message : 'Suche fehlgeschlagen.');
    } finally {
      if (requestGen === dashboardAiGenRef.current) {
        setSuggestLoading(false);
      }
    }
  };

  const toggleDocumentSelection = (id: string) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllSuggestedDocuments = () => {
    setSelectedDocumentIds(suggestedDocuments.map((d) => d.id));
  };

  const clearSuggestedDocumentsSelection = () => {
    setSelectedDocumentIds([]);
  };

  const restoreSuggestedDefaultSelection = () => {
    setSelectedDocumentIds(suggestedDocuments.map((d) => d.id));
  };

  const handleAskWithSelected = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const requestGen = ++dashboardAiGenRef.current;
    setQueryError(null);
    setQueryAnswer(null);
    setQuerySources([]);
    setQueryLoading(true);
    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          documentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'KI-Anfrage fehlgeschlagen.');
      if (requestGen !== dashboardAiGenRef.current) return;
      setQueryAnswer(data.answer);
      setQuerySources(data.sources ?? []);
      await refreshRecentQueries();
    } catch (err: unknown) {
      if (requestGen !== dashboardAiGenRef.current) return;
      setQueryError(err instanceof Error ? err.message : 'Fehler bei der KI-Anfrage.');
    } finally {
      if (requestGen === dashboardAiGenRef.current) {
        setQueryLoading(false);
      }
    }
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
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
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                suggestedDocuments.length > 0
                  ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
              }`}
            >
              1) Dokumente finden
            </span>
            <span className="text-zinc-400">→</span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                queryLoading || queryAnswer
                  ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
              }`}
            >
              2) Antwort erzeugen
            </span>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-2 rounded border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
              <input
                type="text"
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  if (suggestedDocuments.length > 0) setSuggestedDocuments([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSuggestDocuments();
                  }
                }}
                placeholder="z. B. Handynutzung in Pausen, Medienwoche, Leistungsbewertung Oberstufe…"
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              />
            </div>
            <button
              type="button"
              onClick={handleSuggestDocuments}
              className="h-10 rounded bg-zinc-200 px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-300 disabled:opacity-60 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
              disabled={!question.trim() || suggestLoading}
            >
              {suggestLoading ? 'Suche…' : 'Relevante Dokumente finden'}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              onClick={handleAskWithSelected}
              disabled={!question.trim() || queryLoading}
              className="underline-offset-2 hover:underline"
            >
              Ohne Auswahl direkt beantworten
            </button>
          </p>

          {suggestedDocuments.length > 0 && (
            <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-950">
              <h3 className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Relevante Dokumente auswählen
              </h3>
              <p className="mb-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                Wählen Sie die Dokumente, auf deren Basis die KI antworten soll. Dann auf
                „Frage beantworten“ klicken.
              </p>
              <ul className="space-y-2">
                {suggestedDocuments.map((d) => (
                  <li key={d.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id={`doc-${d.id}`}
                      checked={selectedDocumentIds.includes(d.id)}
                      onChange={() => toggleDocumentSelection(d.id)}
                      className="mt-1"
                    />
                    <label htmlFor={`doc-${d.id}`} className="flex flex-1 flex-col">
                      <Link
                        href={`/documents/${d.id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {d.title}
                      </Link>
                      {d.snippet && d.snippet !== '—' && (
                        <span className="mt-0.5 text-[11px] text-zinc-500 line-clamp-2 dark:text-zinc-400">
                          {d.snippet}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  Ausgewählt: {selectedDocumentIds.length}/{suggestedDocuments.length}
                </span>
                <button
                  type="button"
                  onClick={selectAllSuggestedDocuments}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Alle
                </button>
                <button
                  type="button"
                  onClick={clearSuggestedDocumentsSelection}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Keine
                </button>
                <button
                  type="button"
                  onClick={restoreSuggestedDefaultSelection}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Vorauswahl
                </button>
              </div>
              <button
                type="button"
                onClick={handleAskWithSelected}
                disabled={queryLoading || selectedDocumentIds.length === 0}
                className="mt-3 rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {queryLoading ? 'KI antwortet…' : 'Frage mit ausgewählten Dokumenten beantworten'}
              </button>
            </div>
          )}

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
                  <ul className="space-y-2">
                    {querySources.map((s) => (
                      <li key={s.documentId} className="flex flex-col">
                        <Link
                          href={`/documents/${s.documentId}`}
                          className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                        >
                          {s.title}
                        </Link>
                        {s.snippet && s.snippet !== '—' && (
                          <span className="mt-0.5 text-[11px] text-zinc-500 line-clamp-2 dark:text-zinc-400">
                            {s.snippet}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Erste Schritte – nur für neue Schulen sichtbar (alle Benachrichtigungsfelder leer) */}
        {!onboardingDismissed &&
          !publishedLoading &&
          !reviewOverdueLoading &&
          recentlyPublished.length === 0 &&
          reviewOverdue.length === 0 &&
          recentQueries.length === 0 &&
          !publishedLoadError && (
          <section className="rounded-lg border border-blue-200 bg-blue-50/60 p-5 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Willkommen – Erste Schritte
                </h2>
                <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
                  Richten Sie Ihre Schule in drei Schritten ein:
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOnboardingDismissed(true);
                  try { localStorage.setItem('onboarding_dismissed', '1'); } catch { /* ignore */ }
                }}
                aria-label="Hinweis schließen"
                className="rounded p-1 text-blue-400 transition hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/40"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {([
                {
                  n: 1,
                  title: 'Metadaten einrichten',
                  desc: 'Dokumenttypen, Organisationseinheiten und KI-Einstellungen im Admin-Bereich konfigurieren.',
                  href: '/admin',
                  cta: 'Zum Admin-Bereich',
                },
                {
                  n: 2,
                  title: 'Dokumente hochladen',
                  desc: 'PDFs oder Word-Dateien mit Metadaten hochladen – Texte werden automatisch indiziert.',
                  href: '/upload',
                  cta: 'Dokument hochladen',
                },
                {
                  n: 3,
                  title: 'KI & Analyse nutzen',
                  desc: 'Dokumente zusammenfassen, Steuerungsrelevanz analysieren und Fragen per KI beantworten.',
                  href: '/#ki-anfrage',
                  cta: 'KI-Anfrage stellen',
                },
              ] as const).map(({ n, title, desc, href, cta }) => (
                <li key={n} className="flex flex-col gap-2 rounded-md border border-blue-200 bg-white p-4 dark:border-blue-900/40 dark:bg-zinc-900">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                    {n}
                  </span>
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{title}</p>
                  <p className="flex-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{desc}</p>
                  <Link
                    href={href}
                    className="mt-1 inline-flex items-center text-[11px] font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                  >
                    {cta} →
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Navigation */}
        <section className="grid gap-3 md:grid-cols-3">
          <Link
            href="/documents"
            className="group flex min-h-[150px] flex-col rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Dokumente verwalten
                </h2>
                <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                  Liste, Filter, Detailansichten und Versionen.
                </p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100 transition group-hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/50">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <span className="mt-auto inline-flex w-full items-center justify-center rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950">
              Zu unseren Dokumenten
            </span>
          </Link>

          <Link
            href="/upload"
            className="group flex min-h-[150px] flex-col rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Dokumente hochladen
                </h2>
                <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                  PDF oder Word in die Dokumentbasis aufnehmen.
                </p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition group-hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/50">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <span className="mt-auto inline-flex w-full items-center justify-center rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950">
              Dokumente hochladen
            </span>
          </Link>

          <Link
            href="/drafts"
            className="group flex min-h-[150px] flex-col rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-violet-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Entwurfsassistent
                </h2>
                <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                  KI-gestützt Entwürfe erstellen und als Dokument speichern.
                </p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-100 transition group-hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900/50">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19h16M7 17l10-10 2 2-10 10H7v-2z" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <span className="mt-auto inline-flex w-full items-center justify-center rounded border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-zinc-900 shadow-sm transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950">
              Neuen Entwurf erstellen
            </span>
          </Link>
        </section>

        {/* Neu veröffentlicht + Aktuelle Anfragen (2 Spalten) */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            {/* Neu veröffentlicht – Hinweis für Gremien */}
            {publishedLoading ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Neu veröffentlicht
                </h2>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  ))}
                </div>
              </div>
            ) : recentlyPublished.length > 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Neu veröffentlicht
                </h2>
                {publishedLoadError && (
                  <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{publishedLoadError}</p>
                )}
                <p className="mb-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                  Diese Dokumente wurden kürzlich veröffentlicht – Hinweis für Gremien.
                </p>
                <ul className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800">
                  {recentlyPublished.map((item) => (
                    <li key={item.documentId} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <Link
                          href={`/documents/${item.documentId}`}
                          className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                        >
                          {item.title}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 pl-3">
                        {relativeDayLabel(item.publishedAt) && (
                          <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                            {relativeDayLabel(item.publishedAt)}
                          </span>
                        )}
                        <span className="whitespace-nowrap text-[11px] text-zinc-500">
                          {new Date(item.publishedAt).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Neu veröffentlicht
                </h2>
                {publishedLoadError && (
                  <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{publishedLoadError}</p>
                )}
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Derzeit keine neuen Veröffentlichungen.
                </p>
              </div>
            )}

            {/* Evaluation/Wiedervorlage */}
            {reviewOverdueLoading ? (
              <div className="rounded-lg border border-rose-200 bg-white p-4 text-sm shadow-sm dark:border-rose-900/40 dark:bg-zinc-900">
                <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Evaluation/Wiedervorlage
                </h2>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  ))}
                </div>
              </div>
            ) : reviewOverdue.length > 0 ? (
              <div className="rounded-lg border border-rose-200 bg-white p-4 text-sm shadow-sm dark:border-rose-900/40 dark:bg-zinc-900">
                <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Evaluation/Wiedervorlage
                </h2>
                {reviewOverdueLoadError && (
                  <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{reviewOverdueLoadError}</p>
                )}
                <p className="mb-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                  Diese veröffentlichten Dokumente sollten zeitnah überprüft werden.
                </p>
                <ul className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800">
                  {reviewOverdue.map((item) => (
                    <li key={item.documentId} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <Link
                          href={`/documents/${item.documentId}`}
                          className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                        >
                          {item.title}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 pl-3">
                        <span className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                          {overdueBadge(item.reviewDate)}
                        </span>
                        <span className="whitespace-nowrap text-[11px] text-zinc-500">
                          {new Date(`${item.reviewDate}T00:00:00`).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Evaluation/Wiedervorlage
                </h2>
                {reviewOverdueLoadError && (
                  <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{reviewOverdueLoadError}</p>
                )}
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Zurzeit keine überfälligen Termine.
                </p>
              </div>
            )}
          </div>

          {/* Aktuelle Anfragen */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Aktuelle Anfragen
            </h2>
            {recentQueries.length === 0 ? (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Noch keine gespeicherten Anfragen. Frage und KI-Antwort werden pro Schule in der
                Datenbank gespeichert und können hier wieder geöffnet werden.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800">
                {recentQueries.map((q) => (
                  <li key={q.id} className="flex items-center justify-between py-2">
                    <button
                      type="button"
                      onClick={() => {
                        const gen = ++dashboardAiGenRef.current;
                        setQuestion(q.question);
                        setQueryError(null);
                        setQueryLoading(false);
                        setSuggestLoading(false);
                        setSuggestedDocuments([]);
                        setSelectedDocumentIds([]);
                        setQuerySources(normalizeQuerySources(q.sources));
                        const excerpt = (q.answer_excerpt ?? '').trim();
                        setQueryAnswer(excerpt.length > 0 ? excerpt : null);
                        void (async () => {
                          try {
                            const { data: row } = await supabase
                              .from('ai_queries')
                              .select('answer_text')
                              .eq('id', q.id)
                              .maybeSingle();
                            if (gen !== dashboardAiGenRef.current) return;
                            const full = (row?.answer_text as string | null | undefined)?.trim() ?? '';
                            if (full.length > 0) {
                              setQueryAnswer(full);
                            }
                          } catch {
                            /* Antwort bleibt ggf. bei Kurzauszug */
                          }
                        })();
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
          </div>
        </section>
      </div>
    </main>
  );
}
