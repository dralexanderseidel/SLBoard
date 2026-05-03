'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CONTEXT_HELP } from '../lib/contextHelpUrls';
import { supabase } from '../lib/supabaseClient';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { useHeaderAccess } from './HeaderAccessContext';
import { toast } from 'sonner';

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

export function UserMenu({ layout = 'toolbar' }: { layout?: 'toolbar' | 'sidebar' }) {
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
        toast.error(j.error ?? 'Export fehlgeschlagen.');
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
      toast.success('Export wurde heruntergeladen.');
    } catch {
      toast.error('Export fehlgeschlagen.');
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
        toast.error(j.error ?? 'Anfrage konnte nicht gesendet werden.');
        return;
      }
      toast.success(j.message ?? 'Löschanfrage wurde gespeichert.');
    } catch {
      toast.error('Anfrage konnte nicht gesendet werden.');
    } finally {
      setDataActionLoading(false);
      setMenuOpen(false);
    }
  };

  if (sessionLoading) {
    return (
      <div
        className={`flex shrink-0 items-center gap-2 text-[11px] ${
          layout === 'sidebar' ? 'text-slate-400' : 'text-zinc-500 dark:text-zinc-300'
        }`}
      >
        Lädt…
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className={`flex shrink-0 items-center gap-2 text-[11px] ${
          layout === 'sidebar' ? 'text-slate-300' : 'text-zinc-600 dark:text-zinc-300'
        }`}
      >
        <span className={layout === 'sidebar' ? 'inline' : 'hidden sm:inline'}>Nicht angemeldet</span>
        <Link
          href="/login"
          className={
            layout === 'sidebar'
              ? 'rounded-lg border border-slate-600 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800'
              : 'rounded-full border border-zinc-300 px-3 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800'
          }
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

  const menuPanelClass =
    'z-50 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900';
  const menuPositionToolbar =
    'absolute right-0 top-full mt-1 min-w-[13rem] max-w-[min(100vw-1.5rem,18rem)]';
  const menuPositionSidebar = 'absolute bottom-full left-0 right-0 mb-1 w-full min-w-0 max-h-[min(70vh,24rem)] overflow-y-auto';

  if (layout === 'sidebar') {
    return (
      <>
        <div className="flex w-full flex-col gap-2 text-left text-slate-100">
          <div className="min-w-0">
            <span className="block truncate text-[11px] text-slate-300">{user.email}</span>
            {accessLoading && !schoolLine ? (
              <span className="text-[10px] text-slate-500">Schule wird geladen…</span>
            ) : schoolLine ? (
              <span
                className="mt-0.5 block truncate text-[10px] font-medium leading-tight text-slate-400"
                title={schoolLine}
              >
                {schoolLine}
              </span>
            ) : null}
          </div>
          <div className="relative w-full" ref={wrapRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-left text-xs font-medium text-slate-100 outline-none transition hover:bg-slate-800/90 focus-visible:ring-2 focus-visible:ring-blue-400/60"
              title="Konto"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-semibold text-slate-100">
                  {initials}
                </span>
                <span className="truncate">Konto &amp; Abmeldung</span>
              </span>
              <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {menuOpen && (
              <div role="menu" className={`${menuPanelClass} ${menuPositionSidebar}`}>
                <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Rollen
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-zinc-800 dark:text-zinc-100">
                    {formatRolesForMenu(accessLoading ? null : access?.roles ?? [])}
                  </p>
                </div>
                <Link
                  href={CONTEXT_HELP.anmeldung}
                  role="menuitem"
                  className="block px-3 py-2 text-xs text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => setMenuOpen(false)}
                >
                  Hilfe: Konto &amp; Anmeldung
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  disabled={
                    dataActionLoading || accessLoading || !access?.schoolNumber || access?.accountInactive
                  }
                  className="w-full px-3 py-2 text-left text-xs text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => void handleExportData()}
                >
                  Daten exportieren (JSON)
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={
                    dataActionLoading || accessLoading || !access?.schoolNumber || access?.accountInactive
                  }
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
            <div role="menu" className={`${menuPanelClass} ${menuPositionToolbar}`}>
              <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Rollen
                </p>
                <p className="mt-0.5 text-xs leading-snug text-zinc-800 dark:text-zinc-100">
                  {formatRolesForMenu(accessLoading ? null : access?.roles ?? [])}
                </p>
              </div>
              <Link
                href={CONTEXT_HELP.anmeldung}
                role="menuitem"
                className="block px-3 py-2 text-xs text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => setMenuOpen(false)}
              >
                Hilfe: Konto &amp; Anmeldung
              </Link>
              <button
                type="button"
                role="menuitem"
                disabled={
                  dataActionLoading || accessLoading || !access?.schoolNumber || access?.accountInactive
                }
                className="w-full px-3 py-2 text-left text-xs text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => void handleExportData()}
              >
                Daten exportieren (JSON)
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={
                  dataActionLoading || accessLoading || !access?.schoolNumber || access?.accountInactive
                }
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
