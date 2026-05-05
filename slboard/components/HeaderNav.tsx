'use client';

import type { ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppNavLink } from './AppNavLink';
import {
  NavIconAdmin,
  NavIconDashboard,
  NavIconDocuments,
  NavIconDrafts,
  NavIconHelp,
  NavIconSeCockpit,
} from './navLinkIcons';
import { SuperAdminNavLink } from './SuperAdminNavLink';
import { useHeaderAccess } from './HeaderAccessContext';
import { CONTEXT_HELP } from '../lib/contextHelpUrls';

const pill =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800';

const pillCompact =
  'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800';

const pillSuperCompact =
  'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-950/60';

const pillAdmin =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200';

const navIconSm = 'size-3.5 opacity-85 sm:size-4 sm:opacity-90';

const moreMenuItem =
  'flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-xs font-medium text-zinc-800 no-underline hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800';

const moreMenuItemAdmin =
  'flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200';

const moreMenuSuperAdmin =
  'flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-xs font-medium text-amber-900 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/50';

function pathMatches(pathname: string, href: string): boolean {
  const base = (href.split('#')[0] ?? href).trim();
  if (!base) return false;
  if (base === '/') return pathname === '/';
  return pathname === base || pathname.startsWith(`${base}/`);
}

function MoreChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-3.5 shrink-0 text-zinc-600 transition-transform duration-200 dark:text-zinc-300 ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export type HeaderNavLayout = 'horizontal' | 'sidebar';

export function HeaderNav({ layout = 'horizontal' }: { layout?: HeaderNavLayout }) {
  const pathname = usePathname();
  const { access, accessLoading } = useHeaderAccess();
  const showSuperOnMobile = !accessLoading && !!access?.superAdmin;
  const hideDraftsAssistant =
    !accessLoading && access != null && access.featureDraftsEnabled === false;

  const [moreOpen, setMoreOpen] = useState(false);
  const moreWrapRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;

    const focusFirstItem = () => {
      requestAnimationFrame(() => {
        const first = menuRef.current?.querySelector<HTMLElement>('a[href]');
        first?.focus();
      });
    };
    focusFirstItem();

    const onDocMouseDown = (e: MouseEvent) => {
      if (moreWrapRef.current && !moreWrapRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMoreOpen(false);
        queueMicrotask(() => moreBtnRef.current?.focus());
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const closeMore = () => setMoreOpen(false);

  if (layout === 'sidebar') {
    type IconComp = ComponentType<{ className?: string }>;
    const sideItem = (href: string, label: string, Icon: IconComp, extraInactive = '') => {
      const on = pathMatches(pathname, href);
      return (
        <AppNavLink
          key={href + label}
          href={href}
          className={`block rounded-md px-3 py-2 text-sm font-medium no-underline transition ${
            on
              ? 'bg-slate-800 text-white shadow-sm'
              : `text-slate-200 hover:bg-slate-800/80 hover:text-white ${extraInactive}`
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Icon className="size-4 shrink-0 opacity-90" />
            {label}
          </span>
        </AppNavLink>
      );
    };

    return (
      <nav className="flex flex-col gap-0.5" aria-label="Hauptnavigation">
        {sideItem('/', 'Startseite', NavIconDashboard)}
        {sideItem('/se-cockpit', 'Steuerungs-Cockpit', NavIconSeCockpit)}
        {sideItem('/documents', 'Dokumente', NavIconDocuments)}
        {!hideDraftsAssistant ? sideItem('/drafts', 'Entwurfsassistent', NavIconDrafts) : null}
        {sideItem(CONTEXT_HELP.einleitung, 'Hilfe', NavIconHelp)}
        {sideItem(
          '/admin',
          'Admin',
          NavIconAdmin,
          'text-slate-400 hover:text-slate-100',
        )}
        {accessLoading ? null : access?.superAdmin ? (
          <SuperAdminNavLink
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium no-underline transition ${
              pathMatches(pathname, '/super-admin')
                ? 'bg-amber-900/60 text-amber-50 shadow-sm'
                : 'text-amber-200 hover:bg-amber-950/40 hover:text-amber-50'
            }`}
          />
        ) : null}
      </nav>
    );
  }

  return (
    <>
      <nav
        className="hidden min-h-[2.5rem] min-w-0 flex-1 flex-nowrap items-center justify-start gap-x-2.5 overflow-x-auto pl-1 text-xs font-medium text-zinc-700 [scrollbar-width:thin] sm:gap-x-3 md:flex md:gap-x-4 dark:text-zinc-200 [&>*]:shrink-0"
        aria-label="Hauptnavigation"
      >
        <AppNavLink href="/" className={pill}>
          <NavIconDashboard className={navIconSm} />
          Startseite
        </AppNavLink>
        <AppNavLink href="/se-cockpit" className={pill}>
          <NavIconSeCockpit className={navIconSm} />
          Steuerungs-Cockpit
        </AppNavLink>
        <AppNavLink href="/documents" className={pill}>
          <NavIconDocuments className={navIconSm} />
          Dokumente
        </AppNavLink>
        {!hideDraftsAssistant ? (
          <AppNavLink href="/drafts" className={pill}>
            <NavIconDrafts className={navIconSm} />
            Entwurfsassistent
          </AppNavLink>
        ) : null}
        <AppNavLink href={CONTEXT_HELP.einleitung} className={pill}>
          <NavIconHelp className={navIconSm} />
          Hilfe
        </AppNavLink>
        <AppNavLink href="/admin" className={pillAdmin}>
          <NavIconAdmin className={navIconSm} />
          Admin
        </AppNavLink>
        <SuperAdminNavLink />
      </nav>

      <div className="relative flex min-h-[2.5rem] min-w-0 flex-1 items-center gap-1.5 pl-0.5 md:hidden">
        <AppNavLink href="/" onClick={closeMore} className={`${pillCompact} text-zinc-700 dark:text-zinc-200`}>
          <NavIconDashboard className="size-3.5 opacity-90" />
          Startseite
        </AppNavLink>
        <AppNavLink
          href="/se-cockpit"
          onClick={closeMore}
          className={`${pillCompact} text-zinc-700 dark:text-zinc-200`}
        >
          <NavIconSeCockpit className="size-3.5 opacity-90" />
          Steuerungs-Cockpit
        </AppNavLink>
        <AppNavLink
          href="/documents"
          onClick={closeMore}
          className={`${pillCompact} text-zinc-700 dark:text-zinc-200`}
        >
          <NavIconDocuments className="size-3.5 opacity-90" />
          Dokumente
        </AppNavLink>
        {showSuperOnMobile ? (
          <SuperAdminNavLink onClick={closeMore} className={pillSuperCompact} />
        ) : null}
        <div className="relative shrink-0" ref={moreWrapRef}>
          <button
            ref={moreBtnRef}
            type="button"
            id="header-nav-more-button"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            aria-controls="header-nav-more-menu"
            title={moreOpen ? 'Menü schließen' : 'Weitere Seiten: Entwurfsassistent, Hilfe, Admin …'}
            onClick={() => setMoreOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-800 shadow-sm outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <span>Mehr</span>
            <MoreChevronIcon open={moreOpen} />
          </button>
          {moreOpen ? (
            <div
              ref={menuRef}
              id="header-nav-more-menu"
              role="menu"
              aria-labelledby="header-nav-more-button"
              className="absolute right-0 top-full z-50 mt-1 min-w-[13.5rem] max-w-[min(100vw-2rem,20rem)] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              <AppNavLink href="/se-cockpit" role="menuitem" onClick={closeMore} className={moreMenuItem}>
                <NavIconSeCockpit className="size-4 opacity-90" />
                Steuerungs-Cockpit
              </AppNavLink>
              {!hideDraftsAssistant ? (
                <AppNavLink
                  href="/drafts"
                  role="menuitem"
                  onClick={closeMore}
                  className={moreMenuItem}
                >
                  <NavIconDrafts className="size-4 opacity-90" />
                  Entwurfsassistent
                </AppNavLink>
              ) : null}
              <AppNavLink href={CONTEXT_HELP.einleitung} role="menuitem" onClick={closeMore} className={moreMenuItem}>
                <NavIconHelp className="size-4 opacity-90" />
                Hilfe
              </AppNavLink>
              <AppNavLink href="/admin" role="menuitem" onClick={closeMore} className={moreMenuItemAdmin}>
                <NavIconAdmin className="size-4 opacity-90" />
                Admin
              </AppNavLink>
              {!showSuperOnMobile ? (
                <SuperAdminNavLink
                  role="menuitem"
                  onClick={closeMore}
                  className={moreMenuSuperAdmin}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
