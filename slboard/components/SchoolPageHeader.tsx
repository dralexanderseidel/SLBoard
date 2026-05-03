'use client';

import { useHeaderAccess } from './HeaderAccessContext';

/**
 * Schul-Kontext oben im Inhaltsbereich (alle Seiten): Schulname + Schulnummer wie im Cockpit-Mockup.
 */
export function SchoolPageHeader() {
  const { access, accessLoading, userEmail } = useHeaderAccess();

  if (!userEmail) return null;

  const num = access?.schoolNumber?.trim() ?? '';
  const name = access?.schoolName?.trim() ?? '';
  const superOnly = access?.superAdmin && !num && !name;

  return (
    <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:px-6 md:py-3.5">
      {accessLoading ? (
        <div className="flex flex-col gap-2">
          <div className="h-6 w-56 max-w-full animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-32 max-w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/80" />
        </div>
      ) : superOnly ? (
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50 md:text-lg">Super-Admin</p>
      ) : name || num ? (
        <div className="min-w-0">
          {name ? (
            <p className="truncate text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-lg">
              {name}
            </p>
          ) : null}
          {num ? (
            <p
              className={
                name
                  ? 'mt-1 text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-400'
                  : 'text-base font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50 md:text-lg'
              }
            >
              Schulnummer {num}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Kein Schul-Kontext hinterlegt.</p>
      )}
    </header>
  );
}
