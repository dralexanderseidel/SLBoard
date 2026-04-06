'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type SourceDoc = {
  id: string;
  title: string;
  created_at: string;
  document_type_code?: string;
};

type UsedSource = {
  documentId: string;
  title: string;
};

type MeAccess = {
  schoolNumber: string | null;
  schoolName: string | null;
};

function DraftAssistantContent() {
  const searchParams = useSearchParams();
  const sourceIdParam = searchParams.get('sourceId');
  const subjectParam = searchParams.get('subject');

  const [subject, setSubject] = useState('');
  const [audience, setAudience] = useState('Adressaten (z. B. Kollegium, Eltern, Gremium)');
  const [context, setContext] = useState('');
  const [body, setBody] = useState('');
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [lastUsedSources, setLastUsedSources] = useState<UsedSource[]>([]);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('ELTERNBRIEF');
  const [sourceSearchInput, setSourceSearchInput] = useState('');
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAfterSaveActions, setShowAfterSaveActions] = useState(false);
  const [meAccess, setMeAccess] = useState<MeAccess | null>(null);

  useEffect(() => {
    if (subjectParam) setSubject(decodeURIComponent(subjectParam));
  }, [subjectParam]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/me/access');
        if (!res.ok) return;
        const data = (await res.json()) as MeAccess;
        setMeAccess(data);
      } catch {
        // optional
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const loadSources = async () => {
      let q = supabase
        .from('documents')
        .select('id, title, created_at, document_type_code')
        .is('archived_at', null)
        .in('status', ['FREIGEGEBEN', 'BESCHLUSS', 'VEROEFFENTLICHT'])
        .order('created_at', { ascending: false });

      if (meAccess?.schoolNumber) {
        q = q.eq('school_number', meAccess.schoolNumber);
      }

      if (sourceTypeFilter) {
        q = q.eq('document_type_code', sourceTypeFilter);
      }

      const s = sourceSearchQuery.trim();
      if (s) {
        const pattern = `%${s}%`;
        q = q.or(`title.ilike.${pattern},search_text.ilike.${pattern}`);
      }

      const { data } = await q.limit(20);

      const list = data ?? [];
      setSources(list);

      if (sourceIdParam) {
        const exists = list.some((d) => d.id === sourceIdParam);
        if (exists) {
          setSelectedSourceIds((prev) =>
            prev.includes(sourceIdParam) ? prev : [...prev, sourceIdParam],
          );
        } else {
          let one = supabase
            .from('documents')
            .select('id, title, created_at, document_type_code')
            .is('archived_at', null)
            .eq('id', sourceIdParam);
          if (meAccess?.schoolNumber) {
            one = one.eq('school_number', meAccess.schoolNumber);
          }
          const { data: sourceDoc } = await one.single();
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
  }, [sourceIdParam, meAccess?.schoolNumber, sourceTypeFilter, sourceSearchQuery]);

  const toggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);

  const resetDraftForm = () => {
    setSubject('');
    setAudience('Adressaten (z. B. Kollegium, Eltern, Gremium)');
    setContext('');
    setBody('');
    setSelectedSourceIds([]);
    setLastUsedSources([]);
    setShowAfterSaveActions(false);
    setMessage(null);
    setError(null);
    setSavedDocumentId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSavedDocumentId(null);
    setShowAfterSaveActions(false);

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
          audience: audience.trim() || 'Adressaten (z. B. Kollegium, Eltern, Gremium)',
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
      setShowAfterSaveActions(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Speichern des Entwurfs.');
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
    if (body.trim().length > 0) {
      const ok = window.confirm(
        'Im Entwurfstext steht bereits Inhalt. Soll der Text durch den KI-Vorschlag ersetzt werden?'
      );
      if (!ok) return;
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
      const nextBody = typeof data.body === 'string' ? data.body : '';
      if (!nextBody.trim()) {
        throw new Error('KI-Vorschlag ist leer oder konnte nicht verarbeitet werden.');
      }
      setSubject(data.suggestedTitle ?? subject);
      setBody(nextBody);
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
              Entwurf für ein Dokument auf Basis vorhandener Vorlagen erstellen. Die KI kann einen
              Vorschlag generieren.
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
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                1) Thema & Zielgruppe
              </span>
              <span className="text-zinc-400">→</span>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                2) Quellen (optional)
              </span>
              <span className="text-zinc-400">→</span>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                3) KI/Manuell
              </span>
              <span className="text-zinc-400">→</span>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                4) Speichern
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Betreff *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="z. B. Hinweis zur Handynutzung in Pausen / Ablauf der Medienwoche / Beschluss der Schulkonferenz"
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
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                  placeholder="z. B. Anlass, Ziel, Rahmenbedingungen, gewünschter Ton, konkrete Regeln/Termine."
                  className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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
              <div className="relative">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  placeholder="Anrede,&#10;&#10;kurzer Einstieg (Anlass).&#10;&#10;Kernpunkte / Regelungen / Termine.&#10;&#10;Rückfragen / Kontakt.&#10;&#10;Grußformel"
                />
                {draftLoading && (
                  <div className="pointer-events-none absolute inset-0 rounded border border-blue-200 bg-white/70 p-3 text-[11px] text-zinc-600 backdrop-blur-sm dark:border-blue-900/40 dark:bg-zinc-950/60 dark:text-zinc-300">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-300" />
                      <span>KI erstellt einen Vorschlag…</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 w-11/12 rounded bg-zinc-200 dark:bg-zinc-800" />
                      <div className="h-2 w-10/12 rounded bg-zinc-200 dark:bg-zinc-800" />
                      <div className="h-2 w-9/12 rounded bg-zinc-200 dark:bg-zinc-800" />
                      <div className="h-2 w-8/12 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
            {message && <p className="text-xs text-green-600">{message}</p>}
            {showAfterSaveActions && (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowAfterSaveActions(false)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Weiter bearbeiten
                </button>
                <button
                  type="button"
                  onClick={resetDraftForm}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Neuer Entwurf
                </button>
              </div>
            )}
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
              <p className="mb-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                Beim Speichern wird ein Dokument mit <span className="font-medium">Status „Entwurf“</span> angelegt
                (Schutzklasse 2). Der Dokumenttyp ist aktuell fest hinterlegt.
              </p>
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
            <p className="mb-3 text-[11px] text-zinc-600 dark:text-zinc-400">
              Es werden nur Dokumente der eigenen Schule angezeigt. Als Vorlagen stehen nur freigegebene oder
              veröffentlichte Dokumente zur Verfügung.
            </p>

            <div className="mb-3 grid gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                  Dokumenttyp
                </label>
                <select
                  value={sourceTypeFilter}
                  onChange={(e) => setSourceTypeFilter(e.target.value)}
                  className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="">Alle</option>
                  <option value="ELTERNBRIEF">Elternbrief</option>
                  <option value="RUNDSCHREIBEN">Rundschreiben</option>
                  <option value="KONZEPT">Konzept</option>
                  <option value="PROTOKOLL">Protokoll</option>
                  <option value="BESCHLUSSVORLAGE">Beschlussvorlage</option>
                  <option value="CURRICULUM">Curriculum</option>
                  <option value="VEREINBARUNG">Vereinbarung</option>
                  <option value="SITUATIVE_REGELUNG">Situative Regelung</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                  Suche (Titel + Inhalt)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sourceSearchInput}
                    onChange={(e) => setSourceSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setSourceSearchQuery(sourceSearchInput.trim());
                      }
                    }}
                    placeholder="z. B. Handynutzung, Medienwoche…"
                    className="h-8 w-full rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => setSourceSearchQuery(sourceSearchInput.trim())}
                    className="h-8 rounded bg-blue-600 px-3 text-[11px] font-medium text-white shadow-sm transition hover:bg-blue-700"
                  >
                    Suchen
                  </button>
                </div>
                {sourceSearchQuery && (
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    Aktuelle Suche: <span className="font-medium">{sourceSearchQuery}</span>
                  </p>
                )}
              </div>
            </div>

            {sources.length === 0 ? (
              <div className="space-y-2">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Es wurden noch keine passenden Vorlagen gefunden. Laden Sie zunächst einige Dokumente hoch, um sie
                  hier auswählen zu können.
                </p>
                <Link
                  href="/upload"
                  className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-[11px] font-medium text-white shadow-sm transition hover:bg-blue-700"
                >
                  Dokumente hochladen
                </Link>
              </div>
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
                        {doc.document_type_code ? `${doc.document_type_code} · ` : ''}
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

