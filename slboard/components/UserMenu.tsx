'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

type SessionUser = {
  email: string | null;
};

export function UserMenu() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-300">
        Lädt…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
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

  const initials =
    user.email?.trim().charAt(0).toUpperCase() ?? '?';

  return (
    <div className="flex items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-200">
      <span className="hidden sm:inline max-w-[160px] truncate">
        {user.email}
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="hidden rounded-full border border-zinc-300 px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:inline"
      >
        Abmelden
      </button>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
        {initials}
      </div>
    </div>
  );
}

