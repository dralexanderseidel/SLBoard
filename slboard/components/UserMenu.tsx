'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { useHeaderAccess } from './HeaderAccessContext';

type SessionUser = {
  email: string | null;
};

/** Anzeigenamen für user_roles.role_code (ergänzen bei neuen Codes). */
const ROLE_LABEL_DE: Record<string, string> = {
  SCHULLEITUNG: 'Schulleitung',
  SEKRETARIAT: 'Sekretariat',
  VERWALTUNG: 'Verwaltung',
  KOORDINATION: 'Koordination',
  LEHRKRAFT: 'Lehrkraft',
  FACHVORSITZ: 'Fachvorsitz',
  STEUERGRUPPE: 'Steuergruppe',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super-Admin',
};

function formatRolesForMenu(codes: string[] | null): string {
  if (codes === null) return '…';
  if (codes.length === 0) return 'Keine Rollen hinterlegt';
  return codes.map((c) => ROLE_LABEL_DE[c] ?? c).join(', ');
}

export function UserMenu() {
  const { userEmail, sessionLoading, access, accessLoading } = useHeaderAccess();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [dataActionLoading, setDataActionLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const user: SessionUser | null = userEmail ? { email: userEmail } : null;

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await fetch('/api/auth/set-school-context', { method: 'DELETE', credentials: 'include' });
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut();
    window.location.assign('/login');
  };

  const handleExportData = async () => {
    setDataActionLoading(true);
    try {
      const res = await fetch('/api/me/export', { credentials: 'include' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(j.error ?? 'Export fehlgeschlagen.');
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition');
      const m = cd?.match(/filename="([^"]+)"/);
      const name = m?.[1] ?? 'slboard-datenexport.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Export fehlgeschlagen.');
    } finally {
      setDataActionLoading(false);
      setMenuOpen(false);
    }
  };

  const handleDeleteRequest = async () => {
    const ok = window.confirm(
      'Hiermit stellen Sie eine Löschanfrage. Ihr Konto wird nicht automatisch gelöscht; ein Administrator bearbeitet die Anfrage. Fortfahren?'
    );
    if (!ok) return;
    setDataActionLoading(true);
    try {
      const res = await fetch('/api/me/delete-request', { method: 'POST', credentials: 'include' });
      const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        window.alert(j.error ?? 'Anfrage konnte nicht gesendet werden.');
        return;
      }
      window.alert(j.message ?? 'Löschanfrage wurde gespeichert.');
    } catch {
      window.alert('Anfrage konnte nicht gesendet werden.');
    } finally {
      setDataActionLoading(false);
      setMenuOpen(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-300">
        Lädt…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
        <span className="hidden sm:inline">Nicht angemeldet</span>
        <Link
          href="/login"
          className="rounded-full border border-zinc-300 px-3 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Anmelden
        </Link>
      </div>
    );
  }

  const initials = user.email?.trim().charAt(0).toUpperCase() ?? '?';
  const schoolLine =
    access?.schoolNumber || access?.schoolName
      ? access.schoolName
        ? `${access.schoolName} (${access.schoolNumber ?? '—'})`
        : (access.schoolNumber ?? '')
      : null;

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-200">
        <div className="hidden min-w-0 flex-col items-end text-right sm:flex">
          <span className="max-w-[min(12rem,36vw)] truncate">{user.email}</span>
          {accessLoading && !schoolLine ? (
            <span className="text-[10px] text-zinc-400">Schule wird geladen…</span>
          ) : schoolLine ? (
            <span
              className="max-w-[min(14rem,42vw)] truncate text-[10px] font-medium leading-tight text-zinc-500 dark:text-zinc-400"
              title={schoolLine}
            >
              {schoolLine}
            </span>
          ) : null}
        </div>
        <div className="relative" ref={wrapRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700 ring-zinc-400 transition hover:ring-2 focus:outline-none focus:ring-2 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-500"
            title="Konto"
          >
            {initials}
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 min-w-[13rem] max-w-[min(100vw-1.5rem,18rem)] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Rollen
                </p>
                <p className="mt-0.5 text-xs leading-snug text-zinc-800 dark:text-zinc-100">
                  {formatRolesForMenu(accessLoading ? null : access?.roles ?? [])}
                </p>
              </div>
              <button
                type="button"
                role="menuitem"
                disabled={dataActionLoading || accessLoading || !access?.schoolNumber}
                className="w-full px-3 py-2 text-left text-xs text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => void handleExportData()}
              >
                Daten exportieren (JSON)
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={dataActionLoading || accessLoading || !access?.schoolNumber}
                className="w-full px-3 py-2 text-left text-xs text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => void handleDeleteRequest()}
              >
                Löschanfrage stellen
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-xs text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  setMenuOpen(false);
                  setPwdOpen(true);
                }}
              >
                Passwort ändern
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-xs text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => void handleLogout()}
              >
                Abmelden
              </button>
            </div>
          )}
        </div>
      </div>
      <ChangePasswordDialog open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </>
  );
}
