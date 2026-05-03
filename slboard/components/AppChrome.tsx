'use client';

import type { ReactNode } from 'react';
import { AppNavLink } from './AppNavLink';
import { GlobalSearch } from './GlobalSearch';
import { HeaderNav } from './HeaderNav';
import { LogOsLogo } from './LogOsLogo';
import { SchoolPageHeader } from './SchoolPageHeader';
import { UserMenu } from './UserMenu';

type Props = {
  children: ReactNode;
};

/**
 * App-Shell: mobil weiterhin horizontale Kopfzeile; ab md linke Sidebar (Navigation, Suche, Konto).
 */
export function AppChrome({ children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 md:h-svh md:max-h-svh md:flex-row md:overflow-hidden">
      {/* Mobil: bisherige Kopfzeile */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90 md:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 sm:px-6 md:flex-row md:items-center md:gap-3 lg:gap-4">
          <div className="flex min-w-0 w-full flex-1 items-center gap-2 sm:gap-3 md:gap-3 lg:gap-4">
            <AppNavLink href="/" className="flex shrink-0 items-center self-center">
              <LogOsLogo />
            </AppNavLink>
            <HeaderNav layout="horizontal" />
          </div>
          <div className="flex w-full min-w-0 items-center justify-end gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800 md:w-auto md:shrink-0 md:border-0 md:pt-0">
            <div className="min-w-0 flex-1 md:flex-none">
              <GlobalSearch variant="header" />
            </div>
            <div className="flex shrink-0 items-center border-l border-zinc-200 pl-3 sm:pl-4 dark:border-zinc-700 md:pl-6">
              <UserMenu layout="toolbar" />
            </div>
          </div>
        </div>
      </header>

      {/* Desktop: linke Leiste */}
      <aside
        className="relative hidden w-[21rem] shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100 md:sticky md:top-0 md:flex md:min-h-screen"
        aria-label="Hauptnavigation"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-slate-700/80 px-4 py-4">
            <AppNavLink href="/" className="block outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 rounded-md">
              <img
                src="/log-os-logo-dark.png"
                alt=""
                width={260}
                height={96}
                decoding="async"
                className="h-[4.75rem] w-auto max-w-full object-contain object-left md:h-[6rem]"
              />
            </AppNavLink>
            <p className="mt-2 text-[11px] leading-snug text-slate-400">
              Dokumentenbasis, Suche und KI — Schulentwicklung vorbereiten.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-2 py-3">
            <HeaderNav layout="sidebar" />
          </div>

          <div className="shrink-0 border-t border-slate-700/80 px-3 py-3">
            <GlobalSearch variant="sidebar" />
          </div>

          <div className="shrink-0 border-t border-slate-700/80 px-3 py-3">
            <UserMenu layout="sidebar" />
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:h-full md:overflow-hidden">
        <SchoolPageHeader />
        <div
          id="main-content"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        >
          {children}
        </div>
        <footer className="shrink-0 border-t border-zinc-200 bg-zinc-50/80 py-4 text-center text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <AppNavLink href="/datenschutz" className="hover:underline">
              Datenschutz
            </AppNavLink>
            <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
              ·
            </span>
            <AppNavLink href="/impressum" className="hover:underline">
              Impressum
            </AppNavLink>
          </nav>
        </footer>
      </div>
    </div>
  );
}
