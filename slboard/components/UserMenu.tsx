'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import { ChangePasswordDialog } from './ChangePasswordDialog';

type SessionUser = {
  email: string | null;
};

export function UserMenu() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const toSessionUser = (u: { email?: string | null } | null): SessionUser | null =>
      u ? { email: u.email ?? null } : null;

    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(toSessionUser(session?.user ?? null));
      setLoading(false);
    };

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toSessionUser(session?.user ?? null));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
  };

  if (loading) {
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

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-200">
        <span className="hidden max-w-[160px] truncate sm:inline">{user.email}</span>
        <div className="relative" ref={wrapRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700 ring-zinc-400 transition hover:ring-2 focus:outline-none focus:ring-2 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-500"
            title="Konto"
          >
            {initials}
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
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
