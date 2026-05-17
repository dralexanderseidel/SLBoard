'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { DEFAULT_ORG_UNIT_NAMES, PARTICIPATION_GROUP_OPTIONS } from '@/lib/documentMeta';
import { readApiJson } from '@/lib/readApiJson';
import { LONG_RUNNING_EXPECTATION_HINT } from '@/lib/longRunningExpectationHint';
import { CONTEXT_HELP } from '@/lib/contextHelpUrls';
import { ContextHelpLink } from '@/components/ContextHelpLink';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';
import { WORKFLOW_STATUS_ORDER, statusLabelDe } from '@/lib/documentWorkflow';

type Status = 'ENTWURF' | 'FREIGEGEBEN' | 'BESCHLUSS' | 'VEROEFFENTLICHT';
type ReachScope = 'intern' | 'extern';

type UploadItem = {
  id: string;
  file: File;
  title: string;
  /** Client-seitiger Validierungsfehler (Größe / MIME) */
  validationError?: string;
};

const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES_CLIENT = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.oasis.opendocument.text',
]);

function getTodayISODateLocal(): string {
  const d = new Date();
  const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

export default function UploadPage() {

  const [type, setType] = useState('PROTOKOLL');
  const [typeOptions, setTypeOptions] = useState<Array<{ code: string; label: string }>>([]);
  const [date, setDate] = useState(() => getTodayISODateLocal());
  const [status, setStatus] = useState<Status>('ENTWURF');
  const [reachScope, setReachScope] = useState<ReachScope>('intern');
  const [protectionClass, setProtectionClass] = useState('1');
  const [gremium, setGremium] = useState('');
  const [responsibleUnit, setResponsibleUnit] = useState('Schulleitung');
  const [responsibleUnitOptions, setResponsibleUnitOptions] = useState<string[]>([]);
  const [responsibleCustom, setResponsibleCustom] = useState(false);
  const [participationGroups, setParticipationGroups] = useState<string[]>([]);
  const [participationInput, setParticipationInput] = useState('');
  const [items, setItems] = useState<UploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxUploadBytes, setMaxUploadBytes] = useState(DEFAULT_MAX_UPLOAD_BYTES);

  // Laufende Upload-Requests beim Unmount abbrechen
  const uploadControllersRef = useRef<AbortController[]>([]);
  useEffect(() => {
    return () => { uploadControllersRef.current.forEach((c) => c.abort()); };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/me/access', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { effectiveMaxUploadBytes?: number };
        if (typeof data.effectiveMaxUploadBytes === 'number' && data.effectiveMaxUploadBytes > 0) {
          setMaxUploadBytes(data.effectiveMaxUploadBytes);
        }
      } catch { /* Standardlimit */ }
    })();
  }, []);

  useEffect(() => {
    setItems((prev) =>
      prev.map((it) => {
        let validationError: string | undefined;
        if (it.file.size > maxUploadBytes) {
          validationError = `Zu groß (max. ${Math.round(maxUploadBytes / 1024 / 1024)} MB)`;
        } else if (!ALLOWED_MIME_TYPES_CLIENT.has(it.file.type)) {
          validationError = 'Nur PDF / Word (.pdf, .doc, .docx, .odt)';
        }
        return { ...it, validationError };
      }),
    );
  }, [maxUploadBytes]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/metadata/options', { credentials: 'include', cache: 'no-store' });
        const data = (await res.json()) as {
          documentTypes?: Array<{ code: string; label: string }>;
          responsibleUnits?: string[];
        };
        if (!res.ok) return;
        if (Array.isArray(data.documentTypes) && data.documentTypes.length > 0) {
          setTypeOptions(data.documentTypes);
          if (!data.documentTypes.some((t) => t.code === type)) {
            setType(data.documentTypes[0]!.code);
          }
        }
        if (Array.isArray(data.responsibleUnits) && data.responsibleUnits.length > 0) {
          setResponsibleUnitOptions(data.responsibleUnits);
          if (!data.responsibleUnits.includes(responsibleUnit)) {
            setResponsibleUnit(data.responsibleUnits[0]!);
            setResponsibleCustom(false);
          }
        }
      } catch {
        // ignore (fallback to hardcoded defaults)
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveResponsibleUnits = useMemo(
    () => (responsibleUnitOptions.length > 0 ? responsibleUnitOptions : DEFAULT_ORG_UNIT_NAMES),
    [responsibleUnitOptions],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (items.length === 0) {
      setError('Bitte wählen Sie mindestens eine Datei aus.');
      return;
    }

    if (!date) {
      setError('Bitte geben Sie ein Datum an.');
      return;
    }

    if (!responsibleUnit.trim()) {
      setError('Bitte wählen oder geben Sie „Verantwortlich“ an.');
      return;
    }

    setSubmitting(true);
    uploadControllersRef.current = [];

    try {
      const results = await Promise.all(
        items.map(async (it) => {
          const controller = new AbortController();
          uploadControllersRef.current.push(controller);

          const formData = new FormData();
          formData.set('file', it.file);
          formData.set('title', it.title);
          formData.set('type', type);
          formData.set('date', date);
          formData.set('status', status);
          formData.set('reachScope', reachScope);
          formData.set('protectionClass', protectionClass);
          formData.set('gremium', gremium);
          formData.set('responsibleUnit', responsibleUnit);
          formData.set('participationGroups', JSON.stringify(participationGroups));

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
            signal: controller.signal,
          });
          const data = await readApiJson<{ success?: boolean; error?: string; message?: string }>(res);
          return { ok: res.ok, error: data.error, message: data.message, id: it.id, title: it.title };
        })
      );
      uploadControllersRef.current = [];

      const okCount = results.filter((r) => r.ok).length;
      const fail = results.filter((r) => !r.ok);

      if (fail.length > 0) {
        // Nur erfolgreiche Dateien aus der Liste entfernen — fehlgeschlagene bleiben zum Wiederholen
        const successIds = new Set(results.filter((r) => r.ok).map((r) => r.id));
        setItems((prev) => prev.filter((it) => !successIds.has(it.id)));
        setError(
          `Upload teilweise fehlgeschlagen: ${okCount}/${results.length} erfolgreich. ` +
            `Fehler: ${fail.slice(0, 3).map((f) => `${f.title}: ${f.error ?? 'unbekannt'}`).join(' | ')}` +
            (fail.length > 3 ? ' …' : ''),
        );
      } else {
        setMessage(`${okCount}/${results.length} Dokument(e) erfolgreich hochgeladen.`);
        setDate('');
        setGremium('');
        setReachScope('intern');
        setResponsibleCustom(false);
        setResponsibleUnit(
          responsibleUnitOptions[0] ?? DEFAULT_ORG_UNIT_NAMES[0] ?? 'Schulleitung',
        );
        setParticipationGroups([]);
        setParticipationInput('');
        setItems([]);
        const fileInput = document.getElementById('file') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Hochladen.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className={`${APP_PAGE_MAX_OUTER_CLASS} flex flex-col gap-6 py-6 sm:py-8`}>
        <div className="flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold">Dokument hochladen</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Neues Dokument mit Metadaten anlegen und in der Dokumentenbasis ablegen.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <ContextHelpLink href={CONTEXT_HELP.hochladen}>Hilfe zum Hochladen</ContextHelpLink>
            <Link
              href="/"
              className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
            >
              ← Zur Startseite
            </Link>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Dokumenttyp *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {(typeOptions.length > 0
                  ? typeOptions
                  : [
                      { code: 'PROTOKOLL', label: 'Protokoll' },
                      { code: 'BESCHLUSSVORLAGE', label: 'Beschlussvorlage' },
                      { code: 'KONZEPT', label: 'Konzept' },
                      { code: 'CURRICULUM', label: 'Curriculum' },
                      { code: 'VEREINBARUNG', label: 'Vereinbarung' },
                      { code: 'ELTERNBRIEF', label: 'Elternbrief' },
                      { code: 'RUNDSCHREIBEN', label: 'Rundschreiben' },
                      { code: 'SITUATIVE_REGELUNG', label: 'Situative Regelung' },
                    ]
                ).map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Datum *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {WORKFLOW_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {statusLabelDe(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Reichweite *
              </label>
              <select
                value={reachScope}
                onChange={(e) => setReachScope(e.target.value as ReachScope)}
                className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="intern">intern</option>
                <option value="extern">extern</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Schutzklasse *
              </label>
              <select
                value={protectionClass}
                onChange={(e) => setProtectionClass(e.target.value)}
                className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="1">1 – Öffentlich / unkritisch</option>
                <option value="2">2 – Verwaltung/Sekretariat + Schulleitung</option>
                <option value="3">3 – Nur Schulleitung</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                Beschlussgremium
              </label>
              <input
                type="text"
                value={gremium}
                onChange={(e) => setGremium(e.target.value)}
                placeholder="z. B. Schulkonferenz"
                className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Verantwortlich *
            </label>
            {!responsibleCustom ? (
              <select
                value={responsibleUnit}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__custom__') {
                    setResponsibleCustom(true);
                    return;
                  }
                  setResponsibleUnit(v);
                }}
                required
                className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {effectiveResponsibleUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value="__custom__">Andere… (Freitext)</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={responsibleUnit}
                  onChange={(e) => setResponsibleUnit(e.target.value)}
                  required
                  placeholder="z. B. Fachschaft Musik"
                  className="h-8 min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    const cur = responsibleUnit.trim();
                    setResponsibleCustom(false);
                    if (!cur || !effectiveResponsibleUnits.includes(cur)) {
                      setResponsibleUnit(effectiveResponsibleUnits[0] ?? 'Schulleitung');
                    }
                  }}
                  className="h-8 shrink-0 rounded border border-zinc-300 bg-white px-2 text-[11px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Liste
                </button>
              </div>
            )}
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Auswahlliste unter{' '}
              <Link
                href="/admin"
                className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
              >
                Admin → Metadaten
              </Link>
              . „Andere…“ nur bei Bedarf.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Beteiligung
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PARTICIPATION_GROUP_OPTIONS.map((group) => {
                const active = participationGroups.includes(group);
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() =>
                      setParticipationGroups((prev) =>
                        prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
                      )
                    }
                    className={`rounded border px-2 py-1 text-[11px] ${
                      active
                        ? 'border-blue-300 bg-blue-50 text-zinc-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900'
                    }`}
                  >
                    {group}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={participationInput}
                onChange={(e) => setParticipationInput(e.target.value)}
                placeholder="Weitere Gruppe hinzufügen"
                className="h-8 w-full rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => {
                  const value = participationInput.trim();
                  if (!value || participationGroups.includes(value)) return;
                  setParticipationGroups((prev) => [...prev, value].slice(0, 20));
                  setParticipationInput('');
                }}
                className="rounded border border-zinc-300 px-2 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Hinzufügen
              </button>
            </div>
            {participationGroups.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {participationGroups.map((group) => (
                  <span
                    key={group}
                    className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    {group}
                    <button
                      type="button"
                      onClick={() => setParticipationGroups((prev) => prev.filter((g) => g !== group))}
                      className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100"
                      aria-label={`${group} entfernen`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || items.some((it) => !!it.validationError)}
              className="h-9 rounded bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Wird hochgeladen…' : `Dokumente hochladen${items.length ? ` (${items.length})` : ''}`}
            </button>
            {submitting && (
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400" aria-live="polite">
                {LONG_RUNNING_EXPECTATION_HINT}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Dateien (PDF/Word) * — max. {Math.round(maxUploadBytes / 1024 / 1024)} MB pro Datei
            </label>
            <input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx,.odt"
              multiple
              onChange={(e) => {
                setError(null);
                const list = Array.from(e.target.files ?? []);
                const mapped: UploadItem[] = list.map((f) => {
                  let validationError: string | undefined;
                  if (f.size > maxUploadBytes) {
                    validationError = `Zu groß (max. ${Math.round(maxUploadBytes / 1024 / 1024)} MB)`;
                  } else if (!ALLOWED_MIME_TYPES_CLIENT.has(f.type)) {
                    validationError = 'Nur PDF / Word (.pdf, .doc, .docx, .odt)';
                  }
                  return {
                    id: crypto.randomUUID(),
                    file: f,
                    title: f.name.replace(/\.[^/.]+$/, ''),
                    validationError,
                  };
                });
                setItems(mapped);
                const invalid = mapped.filter((m) => m.validationError);
                if (invalid.length > 0) {
                  setError(
                    `${invalid.length} Datei(en) ungültig: ` +
                      invalid.slice(0, 3).map((m) => `${m.file.name} – ${m.validationError}`).join(' | ') +
                      (invalid.length > 3 ? ' …' : ''),
                  );
                }
              }}
              className="text-xs text-zinc-700 file:mr-2 file:rounded file:border-none file:bg-zinc-200 file:px-2 file:py-1 file:text-xs file:font-medium file:text-zinc-800 hover:file:bg-zinc-300 dark:text-zinc-200 dark:file:bg-zinc-700 dark:file:text-zinc-100 dark:hover:file:bg-zinc-600"
            />
            {items.length > 0 && (
              <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                <p className="mb-2 font-medium">
                  Ausgewählte Dateien (Titel wird aus Dateinamen übernommen)
                </p>
                <ul className="space-y-2">
                  {items.map((it, idx) => (
                    <li
                      key={it.id}
                      className={`rounded border p-2 ${
                        it.validationError
                          ? 'border-red-300 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
                          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">{it.file.name}</span>
                        <span className="whitespace-nowrap text-[11px] text-zinc-500 dark:text-zinc-400">
                          {(it.file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </div>
                      {it.validationError && (
                        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{it.validationError}</p>
                      )}
                      <div className="mt-2 grid gap-1">
                        <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                          Titel
                        </label>
                        <input
                          type="text"
                          value={it.title}
                          onChange={(e) => {
                            const v = e.target.value;
                            setItems((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, title: v } : p))
                            );
                          }}
                          className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {message && (
            <div className="space-y-1.5 rounded border border-green-200 bg-green-50/80 px-3 py-2 dark:border-green-900/50 dark:bg-green-950/30">
              <p className="text-xs font-medium text-green-800 dark:text-green-200">{message}</p>
              <Link
                href="/documents"
                className="inline-flex text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
              >
                Zur Dokumentenliste →
              </Link>
            </div>
          )}
        </form>
        </div>
      </div>
    </main>
  );
}

