'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ContextHelpLink } from '../../components/ContextHelpLink';
import { CONTEXT_HELP } from '../../lib/contextHelpUrls';
import { supabase } from '../../lib/supabaseClient';
import { SCHOOL_INACTIVE_BODY, SCHOOL_INACTIVE_TITLE } from '../../lib/schoolInactiveMessages';
import { ACCOUNT_INACTIVE_BODY, ACCOUNT_INACTIVE_TITLE } from '../../lib/accountInactiveMessages';

export function LoginPageClient() {
  const searchParams = useSearchParams();
  const [schoolNumber, setSchoolNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const registrationDone = searchParams.get('registered') === '1';
  const schoolInactive = searchParams.get('reason') === 'school_inactive';
  const accountInactive = searchParams.get('reason') === 'account_inactive';
  const schoolFromQuery = searchParams.get('school') ?? '';

  useEffect(() => {
    if (schoolFromQuery && /^\d{1,6}$/.test(schoolFromQuery)) {
      setSchoolNumber(schoolFromQuery.padStart(6, '0').slice(0, 6));
    }
  }, [schoolFromQuery]);

  /** Session beenden, wenn Proxy/Login wegen gesperrter Schule oder inaktivem Konto hierher umleiten (sonst Schleife Login ↔ Startseite). */
  useEffect(() => {
    if (!schoolInactive && !accountInactive) return;
    void supabase.auth.signOut();
  }, [schoolInactive, accountInactive]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const sn = schoolNumber.trim();
    if (!/^\d{6}$/.test(sn)) {
      setError('Bitte eine gültige 6-stellige Schulnummer eingeben.');
      return;
    }
    setLoading(true);

    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signErr) {
      setLoading(false);
      setError(signErr.message);
      return;
    }

    const res = await fetch('/api/auth/set-school-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ schoolNumber: sn }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      passwordChangeRequired?: boolean;
    };

    if (!res.ok) {
      await supabase.auth.signOut();
      setLoading(false);
      if (res.status === 403 && data.code === 'ACCOUNT_INACTIVE') {
        window.location.assign(
          `/login?reason=account_inactive&school=${encodeURIComponent(sn)}`
        );
        return;
      }
      setError(data.error ?? 'Kein Benutzerkonto für diese Schulnummer.');
      return;
    }

    await supabase.auth.refreshSession();
    setLoading(false);
    if (data.passwordChangeRequired) {
      setMessage('Angemeldet. Bitte legen Sie zuerst Ihr neues Passwort fest.');
      window.location.assign('/change-password?first=1');
      return;
    }
    setMessage('Erfolgreich angemeldet.');
    // Vollladen, damit Proxy/Cookies wie nach F5 konsistent sind (Vercel ≠ lokaler Soft-Nav).
    window.location.assign('/');
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-2 border-b border-zinc-200 pb-3 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold">Anmeldung</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Melden Sie sich mit Schulnummer, E-Mail und Passwort an (ein Konto pro Schule möglich).
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
            <ContextHelpLink href={CONTEXT_HELP.anmeldung}>Hilfe zur Anmeldung</ContextHelpLink>
            <Link
              href="/"
              className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
            >
              ← Zur Startseite
            </Link>
          </div>
        </header>

        {schoolInactive && (
          <div
            role="alert"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          >
            <p className="font-semibold text-amber-950 dark:text-amber-100">{SCHOOL_INACTIVE_TITLE}</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-900/95 dark:text-amber-200/95">
              {SCHOOL_INACTIVE_BODY}
            </p>
          </div>
        )}

        {accountInactive && (
          <div
            role="alert"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          >
            <p className="font-semibold text-amber-950 dark:text-amber-100">{ACCOUNT_INACTIVE_TITLE}</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-900/95 dark:text-amber-200/95">
              {ACCOUNT_INACTIVE_BODY}
            </p>
          </div>
        )}

        <form
          onSubmit={handleLogin}
          className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Schulnummer (6 Ziffern)
            </label>
            <input
              value={schoolNumber}
              onChange={(e) => setSchoolNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              E-Mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {registrationDone && !error && !message && (
            <p className="text-xs text-green-600">
              Schul-Setup erfolgreich abgeschlossen. Bitte jetzt mit Schulnummer und Schuladmin-Konto anmelden.
            </p>
          )}
          {message && <p className="text-xs text-green-600">{message}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="h-9 w-full rounded bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Bitte warten…' : 'Anmelden'}
            </button>
          </div>
        </form>

        <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          <Link href="/datenschutz" className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
            Datenschutz
          </Link>
          <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
          <Link href="/impressum" className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
            Impressum
          </Link>
        </p>
      </div>
    </main>
  );
}
