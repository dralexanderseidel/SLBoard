'use client';

import React, { useState } from 'react';
import Link from 'next/link';

type Status = 'ENTWURF' | 'FREIGEGEBEN' | 'VEROEFFENTLICHT';

type UploadItem = {
  file: File;
  title: string;
};

export default function UploadPage() {
  const getTodayISODateLocal = () => {
    // HTML <input type="date"> erwartet YYYY-MM-DD in *lokaler* Zeit.
    const d = new Date();
    const tzOffsetMinutes = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - tzOffsetMinutes * 60 * 1000);
    return localDate.toISOString().slice(0, 10);
  };

  const [type, setType] = useState('PROTOKOLL');
  const [date, setDate] = useState(() => getTodayISODateLocal());
  const [status, setStatus] = useState<Status>('ENTWURF');
  const [protectionClass, setProtectionClass] = useState('1');
  const [gremium, setGremium] = useState('');
  const [responsibleUnit, setResponsibleUnit] = useState('Schulleitung');
  const [items, setItems] = useState<UploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    setSubmitting(true);

    try {
      const results = await Promise.all(
        items.map(async (it) => {
          const formData = new FormData();
          formData.set('file', it.file);
          formData.set('title', it.title);
          formData.set('type', type);
          formData.set('date', date);
          formData.set('status', status);
          formData.set('protectionClass', protectionClass);
          formData.set('gremium', gremium);
          formData.set('responsibleUnit', responsibleUnit);

          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          const data = (await res.json()) as { success?: boolean; error?: string; message?: string };
          return { ok: res.ok, error: data.error, message: data.message, title: it.title };
        })
      );

      const okCount = results.filter((r) => r.ok).length;
      const fail = results.filter((r) => !r.ok);
      if (fail.length > 0) {
        setError(
          `Upload teilweise fehlgeschlagen: ${okCount}/${results.length} erfolgreich. ` +
            `Fehler: ${fail.slice(0, 3).map((f) => `${f.title}: ${f.error ?? 'unbekannt'}`).join(' | ')}` +
            (fail.length > 3 ? ' …' : '')
        );
      } else {
        setMessage(`${okCount}/${results.length} Dokument(e) erfolgreich hochgeladen.`);
      }

      setDate('');
      setGremium('');
      setItems([]);
      const fileInput = document.getElementById('file') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      setError(err.message ?? 'Unbekannter Fehler beim Hochladen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold">Dokument hochladen</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Neues Dokument mit Metadaten anlegen und in der Dokumentenbasis ablegen.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            ← Zur Startseite
          </Link>
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
                <option value="ENTWURF">Entwurf</option>
                <option value="FREIGEGEBEN">Freigegeben</option>
                <option value="VEROEFFENTLICHT">Veröffentlicht</option>
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
                Gremium
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
              Organisationseinheit *
            </label>
            <input
              type="text"
              value={responsibleUnit}
              onChange={(e) => setResponsibleUnit(e.target.value)}
              required
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="h-9 rounded bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Wird hochgeladen…' : `Dokumente hochladen${items.length ? ` (${items.length})` : ''}`}
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Dateien (PDF/Word) *
            </label>
            <input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx,.odt"
              multiple
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                const mapped: UploadItem[] = list.map((f) => ({
                  file: f,
                  title: (f.name ?? '').replace(/\.[^/.]+$/, ''),
                }));
                setItems(mapped);
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
                      key={`${it.file.name}-${it.file.size}`}
                      className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">{it.file.name}</span>
                        <span className="whitespace-nowrap text-[11px] text-zinc-500 dark:text-zinc-400">
                          {(it.file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </div>
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
          {message && <p className="text-xs text-green-600">{message}</p>}
        </form>
      </div>
    </main>
  );
}

