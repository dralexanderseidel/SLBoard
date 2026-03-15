'use client';

import React, { useState } from 'react';
import Link from 'next/link';

type Status = 'ENTWURF' | 'FREIGEGEBEN';

export default function UploadPage() {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('ELTERNBRIEF');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<Status>('ENTWURF');
  const [protectionClass, setProtectionClass] = useState('1');
  const [gremium, setGremium] = useState('');
  const [responsibleUnit, setResponsibleUnit] = useState('Schulleitung');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!file) {
      setError('Bitte wählen Sie eine Datei aus.');
      return;
    }

    if (!date) {
      setError('Bitte geben Sie ein Datum an.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('title', title);
      formData.set('type', type);
      formData.set('date', date);
      formData.set('status', status);
      formData.set('protectionClass', protectionClass);
      formData.set('gremium', gremium);
      formData.set('responsibleUnit', responsibleUnit);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as { success?: boolean; error?: string; message?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'Unbekannter Fehler beim Hochladen.');
      }

      setMessage(data.message ?? 'Dokument wurde erfolgreich hochgeladen.');
      setTitle('');
      setDate('');
      setGremium('');
      setFile(null);
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
              Neues Dokument mit Metadaten anlegen und im Supabase-Speicher ablegen.
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Titel *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

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
                <option value="ELTERNBRIEF">Elternbrief</option>
                <option value="KONZEPT">Konzept</option>
                <option value="PROTOKOLL">Protokoll</option>
                <option value="RUNDSCHREIBEN">Rundschreiben</option>
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
                <option value="2">2 – Intern</option>
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

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Datei (PDF/Word) *
            </label>
            <input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx,.odt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs text-zinc-700 file:mr-2 file:rounded file:border-none file:bg-zinc-200 file:px-2 file:py-1 file:text-xs file:font-medium file:text-zinc-800 hover:file:bg-zinc-300 dark:text-zinc-200 dark:file:bg-zinc-700 dark:file:text-zinc-100 dark:hover:file:bg-zinc-600"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {message && <p className="text-xs text-green-600">{message}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="h-9 rounded bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Wird hochgeladen…' : 'Dokument hochladen'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

