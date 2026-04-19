'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { MIN_APP_PASSWORD_LENGTH } from '../../lib/authPasswordConstants';

export function ChangePasswordPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFirst = searchParams.get('first') === '1';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < MIN_APP_PASSWORD_LENGTH) {
      setError(`Neues Passwort: mindestens ${MIN_APP_PASSWORD_LENGTH} Zeichen.`);
      return;
    }
    if (newPassword !== confirm) {
      setError('Die Wiederholung des neuen Passworts stimmt nicht überein.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Das neue Passwort muss sich vom bisherigen unterscheiden.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) {
        setError(data.error ?? 'Passwort konnte nicht geändert werden.');
        return;
      }
      await supabase.auth.refreshSession();
      window.location.assign('/');
    } catch {
      setError('Unerwarteter Fehler.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-12">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold">Passwort ändern</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {isFirst
                ? 'Ihr Konto nutzt noch das vom Administrator vergebene Passwort. Bitte wählen Sie ein neues, persönliches Passwort, bevor Sie fortfahren.'
                : 'Neues Passwort setzen. Nutzen Sie ein starkes, persönliches Passwort.'}
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            ← Start
          </Link>
        </header>

        {isFirst && (
          <div
            role="status"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          >
            Sicherheitshinweis: Das initiale Passwort war nicht personengeheim. Durch die Änderung
            stellen Sie sicher, dass nur Sie sich mit Ihrem geheimen Passwort anmelden können.
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Aktuelles Passwort</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Neues Passwort</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={MIN_APP_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <p className="text-[11px] text-zinc-500">Mindestens {MIN_APP_PASSWORD_LENGTH} Zeichen.</p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Neues Passwort (Wiederholung)</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="h-9 w-full rounded bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Speichere…' : 'Neues Passwort speichern'}
            </button>
          </div>
        </form>

        <p className="text-center text-[11px] text-zinc-500">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            Abmelden
          </button>
        </p>
      </div>
    </main>
  );
}
