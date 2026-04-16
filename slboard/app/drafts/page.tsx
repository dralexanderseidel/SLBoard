'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getDraftDocTypeConfig } from '@/lib/draftDocTypes';
import { METADATA_BROADCAST_CHANNEL } from '@/lib/metadataBroadcast';

type DbDocType = {
  code: string;
  label: string;
  draft_audience: string | null;
  draft_tone: string | null;
  draft_format_hint: string | null;
};

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

  const [docType, setDocType] = useState('ELTERNBRIEF');
  const [dbDocTypes, setDbDocTypes] = useState<DbDocType[]>([]);
  const metadataFetchedAtRef = useRef<number>(0);
  const [subject, setSubject] = useState('');
  const [audience, setAudience] = useState('');
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
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);

  const draftAbortControllerRef = useRef<AbortController | null>(null);
  const audienceCustomizedRef = useRef(false);

  // Abort pending KI request on unmount
  useEffect(() => {
    return () => { draftAbortControllerRef.current?.abort(); };
  }, []);

  // Metadaten (Dokumenttypen + Draft-Config) aus DB laden
  const loadMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/metadata/options', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { documentTypes?: DbDocType[] };
      if (Array.isArray(data.documentTypes) && data.documentTypes.length > 0) {
        setDbDocTypes(data.documentTypes);
        metadataFetchedAtRef.current = Date.now();
      }
    } catch { /* Metadaten sind Best-Effort */ }
  }, []);

  // Initialload + BroadcastChannel (cross-tab) + visibilitychange (focus-revalidation)
  useEffect(() => {
    void loadMetadata();

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(METADATA_BROADCAST_CHANNEL);
      channel.onmessage = () => void loadMetadata();
    } catch { /* BroadcastChannel nicht unterstützt */ }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        const ageMs = Date.now() - metadataFetchedAtRef.current;
        if (ageMs > 3 * 60 * 1000) void loadMetadata();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      channel?.close();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadMetadata]);

  const selectedSet = useMemo(() => new Set(selectedSourceIds), [selectedSourceIds]);

  // Initialize from URL params
  useEffect(() => {
    if (subjectParam) setSubject(decodeURIComponent(subjectParam));
  }, [subjectParam]);

  // typeConfig: DB-Werte überschreiben die hardcodierten Defaults aus draftDocTypes.ts
  const typeConfig = useMemo(() => {
    const hardcoded = getDraftDocTypeConfig(docType);
    const db = dbDocTypes.find((t) => t.code === docType);
    return {
      ...hardcoded,
      defaultAudience: db?.draft_audience || hardcoded.defaultAudience,
      tone:            db?.draft_tone     || hardcoded.tone,
      formatInstructions: db?.draft_format_hint || hardcoded.formatInstructions,
    };
  }, [docType, dbDocTypes]);

  // Sicherstellen, dass der aktuelle docType noch in den DB-Typen vorhanden ist
  useEffect(() => {
    if (dbDocTypes.length > 0 && !dbDocTypes.some((t) => t.code === docType)) {
      setDocType(dbDocTypes[0].code);
    }
  }, [dbDocTypes, docType]);

  // Zielgruppe zurücksetzen wenn docType oder DB-Default sich ändert (sofern nicht manuell überschrieben)
  useEffect(() => {
    if (!audienceCustomizedRef.current) {
      setAudience(typeConfig.defaultAudience);
    }
  }, [typeConfig.defaultAudience]);

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

  const resetDraftForm = useCallback(() => {
    setSubject('');
    audienceCustomizedRef.current = false;
    setAudience(typeConfig.defaultAudience);
    setContext('');
    setBody('');
    setSelectedSourceIds([]);
    setLastUsedSources([]);
    setShowAfterSaveActions(false);
    setMessage(null);
    setError(null);
    setSavedDocumentId(null);
    setConfirmOverwrite(false);
  }, [typeConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSavedDocumentId(null);
    setShowAfterSaveActions(false);

    if (!subject.trim()) {
      setError('Bitte geben Sie einen Betreff ein.');
      return;
    }
    if (!body.trim()) {
      setError('Bitte geben Sie einen Entwurfstext ein.');
      return;
    }

    setSaving(true);

    try {
      const res = await fetch('/api/drafts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          audience: audience.trim() || typeConfig.defaultAudience,
          context: context.trim(),
          body: body.trim(),
          documentType: docType,
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
    // Inline-Bestätigung statt window.confirm
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
      const res = await fetch('/api/ai/drafts/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: subject,
          targetAudience: audience,
          purpose: context,
          documentType: docType,
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
      setMessage('KI-Vorschlag wurde eingefügt. Bitte prüfen und ggf. anpassen.');
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
              Entwurf für ein schulisches Dokument auf Basis vorhandener Vorlagen erstellen.
              Die KI kann einen Vorschlag generieren.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            ← Zur Startseite
          </Link>
        </header>

        {/* Dokumenttyp-Auswahl */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-3 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            Welches Dokument möchten Sie erstellen?
          </p>
          {dbDocTypes.length === 0 ? (
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dbDocTypes.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => {
                    setDocType(t.code);
                    audienceCustomizedRef.current = false;
                    setError(null);
                    setMessage(null);
                    setConfirmOverwrite(false);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    docType === t.code
                      ? 'border-blue-500 bg-blue-600 text-white shadow-sm'
                      : 'border-zinc-300 bg-white text-zinc-700 hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-blue-500 dark:hover:bg-blue-950/30'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* Linke Seite: Eingabe und Entwurfstext */}
          <form
            onSubmit={handleSave}
            className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {(['1) Thema & Zielgruppe', '2) Quellen (optional)', '3) KI/Manuell', '4) Speichern'] as const).map((step, i) => (
                <React.Fragment key={step}>
                  {i > 0 && <span className="text-zinc-400">→</span>}
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                    i === 0
                      ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300'
                  }`}>
                    {step}
                  </span>
                </React.Fragment>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Betreff *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={typeConfig.subjectPlaceholder}
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
                  onChange={(e) => {
                    audienceCustomizedRef.current = true;
                    setAudience(e.target.value);
                  }}
                  placeholder={typeConfig.defaultAudience}
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
                  placeholder={typeConfig.contextPlaceholder}
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
                {draftLoading ? 'KI erstellt Vorschlag…' : 'KI-Vorschlag erstellen'}
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
                  placeholder={typeConfig.bodyPlaceholder}
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
                Beim Speichern wird ein Dokument vom Typ{' '}
                <span className="font-medium">{typeConfig.label}</span> mit{' '}
                <span className="font-medium">Status „Entwurf"</span> angelegt (Schutzklasse 2).
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
              Nur Dokumente Ihrer Schule, die Sie lesen dürfen; nicht archiviert.
              Optional nach Dokumenttyp eingrenzen.
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
                  {dbDocTypes.map((t) => (
                    <option key={t.code} value={t.code}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                  Suche
                </label>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  Geben Sie einen Suchbegriff ein und klicken Sie auf „Suchen".
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
                    placeholder="z. B. Handynutzung, Medienwoche…"
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
                      Keine lesbaren Vorlagen für diese Suche. Prüfen Sie die Schreibweise oder
                      laden Sie passende Dokumente hoch.
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
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Lade Entwurfsassistent…</p>
        </div>
      </main>
    }>
      <DraftAssistantContent />
    </Suspense>
  );
}
