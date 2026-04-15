'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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

function DraftAssistantContent() {
  const searchParams = useSearchParams();
  const sourceIdParam = searchParams.get('sourceId');
  const subjectParam = searchParams.get('subject');

  const [subject, setSubject] = useState('');
  const [audience, setAudience] = useState('Adressaten (z.Ã¢â‚¬Â¯B. Kollegium, Eltern, Gremium)');
  const [context, setContext] = useState('');
  const [body, setBody] = useState('');
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [lastUsedSources, setLastUsedSources] = useState<UsedSource[]>([]);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('');
  const [sourceSearchInput, setSourceSearchInput] = useState('');
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAfterSaveActions, setShowAfterSaveActions] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [docTypeOptions, setDocTypeOptions] = useState<Array<{ code: string; label: string }>>([]);

  const draftAbortControllerRef = useRef<AbortController | null>(null);

  // Ausstehende KI-Anfrage beim Unmount abbrechen
  useEffect(() => {
    return () => { draftAbortControllerRef.current?.abort(); };
  }, []);

  const selectedSet = useMemo(() => new Set(selectedSourceIds), [selectedSourceIds]);

  useEffect(() => {
    if (subjectParam) setSubject(decodeURIComponent(subjectParam));
  }, [subjectParam]);

  useEffect(() => {
    fetch('/api/metadata/options', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { documentTypes?: Array<{ code: string; label: string }> }) => {
        if (Array.isArray(data.documentTypes) && data.documentTypes.length > 0) {
          setDocTypeOptions(data.documentTypes);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const loadSources = async () => {
      const q = sourceSearchQuery.trim();
      const typ = sourceTypeFilter.trim();
      const hasBrowse = typ.length > 0 || (sourceIdParam !== null && sourceIdParam.length > 0);
      const hasSearch = q.length > 0;
      if (!hasSearch && !hasBrowse) {
        setSources([]);
        return;
      }

      setSourcesLoading(true);
      try {
        const payload: Record<string, unknown> = { question: q };
        if (typ) payload.documentTypeCode = typ;
        if (sourceIdParam) payload.ensureIds = [sourceIdParam];
        const res = await fetch('/api/ai/suggest-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setSources([]);
          return;
        }
        const data = (await res.json()) as {
          suggestedDocuments?: Array<{
            id: string;
            title: string;
            document_type_code?: string;
            created_at?: string;
          }>;
        };
        const list = data.suggestedDocuments ?? [];
        setSources(
          list.map((d) => ({
            id: d.id,
            title: d.title,
            created_at: d.created_at ?? new Date().toISOString(),
            document_type_code: d.document_type_code,
          })),
        );

        if (sourceIdParam) {
          const exists = list.some((d) => d.id === sourceIdParam);
          if (exists) {
            setSelectedSourceIds((prev) =>
              prev.includes(sourceIdParam) ? prev : [...prev, sourceIdParam],
            );
          }
        }
      } catch {
        setSources([]);
      } finally {
        setSourcesLoading(false);
      }
    };

    void loadSources();
  }, [sourceIdParam, sourceTypeFilter, sourceSearchQuery]);

  const toggleSource = useCallback((id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);

  const resetDraftForm = () => {
    setSubject('');
    setAudience('Adressaten (z.Ã¢â‚¬Â¯B. Kollegium, Eltern, Gremium)');
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
          audience: audience.trim() || 'Adressaten (z.Ã¢â‚¬Â¯B. Kollegium, Eltern, Gremium)',
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
    // Inline-BestÃƒÂ¤tigung statt window.confirm
    if (body.trim().length > 0 && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    setConfirmOverwrite(false);

    // Eventuell laufende Anfrage abbrechen
    draftAbortControllerRef.current?.abort();
    const controller = new AbortController();
    draftAbortControllerRef.current = controller;

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
        signal: controller.signal,
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
      setMessage('KI-Vorschlag wurde eingefÃƒÂ¼gt. Bitte prÃƒÂ¼fen und ggf. anpassen.');
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return;
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
              Entwurf fÃƒÂ¼r ein Dokument auf Basis vorhandener Vorlagen erstellen. Die KI kann einen
              Vorschlag generieren.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            Ã¢â€ Â Zur Startseite
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
              <span className="text-zinc-400">Ã¢â€ â€™</span>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                2) Quellen (optional)
              </span>
              <span className="text-zinc-400">Ã¢â€ â€™</span>
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                3) KI/Manuell
              </span>
              <span className="text-zinc-400">Ã¢â€ â€™</span>
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
                placeholder="z.Ã¢â‚¬Â¯B. Hinweis zur Handynutzung in Pausen / Ablauf der Medienwoche / Beschluss der Schulkonferenz"
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
                  placeholder="z.Ã¢â‚¬Â¯B. Anlass, Ziel, Rahmenbedingungen, gewÃƒÂ¼nschter Ton, konkrete Regeln/Termine."
                  className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDraftSuggestion()}
                disabled={draftLoading}
                className="rounded border border-blue-400 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
              >
                {draftLoading ? 'KI erstellt VorschlagÃ¢â‚¬Â¦' : 'KI-Vorschlag erstellen'}
              </button>
              {confirmOverwrite && (
                <span className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
                  Vorhandener Text wird ersetzt.
                  <button
                    type="button"
                    onClick={() => void handleDraftSuggestion()}
                    className="font-semibold underline underline-offset-2 hover:no-underline"
                  >
                    Ja, ersetzen
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmOverwrite(false)}
                    className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-100"
                  >
                    Abbrechen
                  </button>
                </span>
              )}
            </div>

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
                  placeholder="Anrede,&#10;&#10;kurzer Einstieg (Anlass).&#10;&#10;Kernpunkte / Regelungen / Termine.&#10;&#10;RÃƒÂ¼ckfragen / Kontakt.&#10;&#10;GruÃƒÅ¸formel"
                />
                {draftLoading && (
                  <div className="pointer-events-none absolute inset-0 rounded border border-blue-200 bg-white/70 p-3 text-[11px] text-zinc-600 backdrop-blur-sm dark:border-blue-900/40 dark:bg-zinc-950/60 dark:text-zinc-300">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-300" />
                      <span>KI erstellt einen VorschlagÃ¢â‚¬Â¦</span>
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
                  Dokument ÃƒÂ¶ffnen Ã¢â€ â€™
                </Link>
              </p>
            )}

            <div className="pt-2">
              <p className="mb-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                Beim Speichern wird ein Dokument mit <span className="font-medium">Status Ã¢â‚¬Å¾EntwurfÃ¢â‚¬Å“</span> angelegt
                (Schutzklasse 2). Der Dokumenttyp ist aktuell fest hinterlegt.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="h-9 rounded bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Wird gespeichertÃ¢â‚¬Â¦' : 'Entwurf als Dokument speichern'}
              </button>
            </div>
          </form>

          {/* Rechte Seite: Verwendete Quellen + Auswahl fÃƒÂ¼r nÃƒÂ¤chsten Vorschlag */}
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
              Quellen fÃƒÂ¼r nÃƒÂ¤chsten Vorschlag auswÃƒÂ¤hlen (optional):
            </p>
            <p className="mb-3 text-[11px] text-zinc-600 dark:text-zinc-400">
              Gleiche Suche und Leserechte wie beim Dashboard (Ã¢â‚¬Å¾Relevante Dokumente findenÃ¢â‚¬Å“): nur Ihre Schule,
              nur Dokumente, die Sie lesen dÃƒÂ¼rfen; nicht archiviert; alle Workflow-Status. Optional nach
              Dokumenttyp eingrenzen.
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
                  {(docTypeOptions.length > 0
                    ? docTypeOptions
                    : [
                        { code: 'ELTERNBRIEF', label: 'Elternbrief' },
                        { code: 'RUNDSCHREIBEN', label: 'Rundschreiben' },
                        { code: 'KONZEPT', label: 'Konzept' },
                        { code: 'PROTOKOLL', label: 'Protokoll' },
                        { code: 'BESCHLUSSVORLAGE', label: 'Beschlussvorlage' },
                        { code: 'CURRICULUM', label: 'Curriculum' },
                        { code: 'VEREINBARUNG', label: 'Vereinbarung' },
                        { code: 'SITUATIVE_REGELUNG', label: 'Situative Regelung' },
                      ]
                  ).map((t) => (
                    <option key={t.code} value={t.code}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                  Suche
                </label>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  Geben Sie einen Suchbegriff ein und klicken Sie auf Ã¢â‚¬Å¾SuchenÃ¢â‚¬Å“.
                </p>
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
                    placeholder="z.Ã¢â‚¬Â¯B. Handynutzung, MedienwocheÃ¢â‚¬Â¦"
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

            {sourcesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                ))}
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Suche läuft…</p>
              </div>
            ) : sources.length === 0 ? (
              <div className="space-y-2">
                {!sourceSearchQuery.trim() && !sourceTypeFilter.trim() && !sourceIdParam ? (
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    Geben Sie einen Suchbegriff ein und klicken Sie auf „Suchen".
                  </p>
                ) : (
                  <>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Keine lesbaren Vorlagen für diese Suche. Prüfen Sie die Schreibweise oder laden Sie passende
                      Dokumente hoch.
                    </p>
                    <Link
                      href="/upload"
                      className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-[11px] font-medium text-white shadow-sm transition hover:bg-blue-700"
                    >
                      Dokumente hochladen
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <ul className="space-y-2">
                {sources.map((doc) => (
                  <li key={doc.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id={`draft-src-${doc.id}`}
                      checked={selectedSet.has(doc.id)}
                      onChange={() => toggleSource(doc.id)}
                      className="mt-0.5"
                    />
                    <label htmlFor={`draft-src-${doc.id}`} className="flex flex-1 flex-col">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {doc.title}
                      </Link>
                      <span className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
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
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Lade EntwurfsassistentÃ¢â‚¬Â¦</p>
        </div>
      </main>
    }>
      <DraftAssistantContent />
    </Suspense>
  );
}

