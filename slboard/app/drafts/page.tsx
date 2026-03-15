'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type SourceDoc = {
  id: string;
  title: string;
  created_at: string;
};

type UsedSource = {
  documentId: string;
  title: string;
};

function DraftAssistantContent() {
  const searchParams = useSearchParams();
  const sourceIdParam = searchParams.get('sourceId');
  const subjectParam = searchParams.get('subject');

  const [subject, setSubject] = useState('');
  const [audience, setAudience] = useState('Eltern der Klassen 5–8');
  const [context, setContext] = useState('');
  const [body, setBody] = useState('');
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [lastUsedSources, setLastUsedSources] = useState<UsedSource[]>([]);
  const [saving, setSaving] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subjectParam) setSubject(decodeURIComponent(subjectParam));
  }, [subjectParam]);

  useEffect(() => {
    const loadSources = async () => {
      const { data } = await supabase
        .from('documents')
        .select('id, title, created_at')
        .eq('document_type_code', 'ELTERNBRIEF')
        .in('status', ['FREIGEGEBEN', 'VEROEFFENTLICHT'])
        .order('created_at', { ascending: false })
        .limit(10);

      const list = data ?? [];
      setSources(list);

      if (sourceIdParam) {
        const exists = list.some((d) => d.id === sourceIdParam);
        if (exists) {
          setSelectedSourceIds((prev) =>
            prev.includes(sourceIdParam) ? prev : [...prev, sourceIdParam],
          );
        } else {
          const { data: sourceDoc } = await supabase
            .from('documents')
            .select('id, title, created_at')
            .eq('id', sourceIdParam)
            .single();
          if (sourceDoc) {
            setSources((prev) => [sourceDoc as SourceDoc, ...prev]);
            setSelectedSourceIds((prev) =>
              prev.includes(sourceIdParam) ? prev : [...prev, sourceIdParam],
            );
          }
        }
      }
    };

    void loadSources();
  }, [sourceIdParam]);

  const toggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSavedDocumentId(null);

    if (!subject.trim() || !body.trim()) {
      setError('Bitte geben Sie mindestens Betreff und Entwurfstext ein.');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/drafts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          audience: audience.trim() || 'Eltern der Klassen 5–8',
          context: context.trim(),
          body: body.trim(),
        }),
      });
      const data = (await res.json()) as { documentId?: string; message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'Fehler beim Speichern.');
      }

      setMessage(data.message ?? 'Entwurf wurde als Dokument mit erster Version gespeichert.');
      if (data.documentId) setSavedDocumentId(data.documentId);
      setSubject('');
      setAudience('Eltern der Klassen 5–8');
      setContext('');
      setBody('');
      setSelectedSourceIds([]);
    } catch (err: any) {
      setError(err.message ?? 'Unbekannter Fehler beim Speichern des Entwurfs.');
    } finally {
      setSaving(false);
    }
  };

  const handleDraftSuggestion = async () => {
    setError(null);
    setMessage(null);
    if (!subject.trim()) {
      setError('Bitte geben Sie mindestens einen Betreff ein, damit die KI einen Vorschlag erstellen kann.');
      return;
    }
    setDraftLoading(true);
    try {
      const res = await fetch('/api/ai/drafts/parent-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: subject,
          targetAudience: audience,
          purpose: context,
          sourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'KI-Vorschlag fehlgeschlagen.');
      setSubject(data.suggestedTitle ?? subject);
      setBody(data.body ?? '');
      setLastUsedSources(data.sources ?? []);
      setMessage('KI-Vorschlag wurde eingefügt. Bitte prüfen und ggf. anpassen.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim KI-Vorschlag.');
    } finally {
      setDraftLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold">Entwurfsassistent</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Entwurf für einen Elternbrief auf Basis vorhandener Dokumente erstellen. KI kann
              einen Vorschlag generieren.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            ← Zur Startseite
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* Linke Seite: Eingabe und Entwurfstext */}
          <form
            onSubmit={handleSave}
            className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Betreff *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Antwort auf Elternbeschwerde wegen Handynutzung im Unterricht"
                className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                  Zielgruppe
                </label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                  Kurzbeschreibung / Kontext
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="z. B. Beschwerde über Handynutzung im Unterricht"
                  className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleDraftSuggestion}
              disabled={draftLoading}
              className="rounded border border-blue-400 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
            >
              {draftLoading ? 'KI erstellt Vorschlag…' : 'KI-Vorschlag erstellen'}
            </button>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Entwurfstext *
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="Sehr geehrte Eltern,&#10;&#10;[…]"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
            {message && <p className="text-xs text-green-600">{message}</p>}
            {savedDocumentId && (
              <p className="mt-1 text-xs">
                <Link
                  href={`/documents/${savedDocumentId}`}
                  className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                >
                  Dokument öffnen →
                </Link>
              </p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="h-9 rounded bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Wird gespeichert…' : 'Entwurf als Dokument speichern'}
              </button>
            </div>
          </form>

          {/* Rechte Seite: Verwendete Quellen + Auswahl für nächsten Vorschlag */}
          <aside className="rounded-lg border border-zinc-200 bg-white p-4 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Verwendete Quellen
            </h2>
            {lastUsedSources.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  Bei diesem Vorschlag verwendet:
                </p>
                <ul className="space-y-1">
                  {lastUsedSources.map((s) => (
                    <li key={s.documentId}>
                      <Link
                        href={`/documents/${s.documentId}`}
                        className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                      >
                        {s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mb-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Quellen für nächsten Vorschlag auswählen (optional):
            </p>
            {sources.length === 0 ? (
              <p className="text-zinc-600 dark:text-zinc-400">
                Es wurden noch keine passenden Elternbriefe gefunden. Laden Sie zunächst einige
                Elternbriefe hoch, um sie hier auswählen zu können.
              </p>
            ) : (
              <ul className="space-y-2">
                {sources.map((doc) => (
                  <li key={doc.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id={doc.id}
                      checked={selectedSourceIds.includes(doc.id)}
                      onChange={() => toggleSource(doc.id)}
                      className="mt-0.5"
                    />
                    <label htmlFor={doc.id} className="flex flex-col">
                      <span className="font-medium text-zinc-800 dark:text-zinc-100">
                        {doc.title}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {new Date(doc.created_at).toLocaleDateString('de-DE')}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

export default function DraftAssistantPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Lade Entwurfsassistent…</p>
        </div>
      </main>
    }>
      <DraftAssistantContent />
    </Suspense>
  );
}

