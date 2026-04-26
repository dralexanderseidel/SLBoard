'use client';

import React from 'react';

type Props = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (next: number) => void;
  className?: string;
};

export function DocumentListPagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  className = '',
}: Props) {
  if (totalItems <= 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <nav
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
      aria-label="Seitennavigation Dokumentenliste"
    >
      <p className="text-zinc-600 dark:text-zinc-400">
        Zeige <span className="font-medium text-zinc-900 dark:text-zinc-100">{from}</span>
        {'–'}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{to}</span>
        {' von '}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{totalItems}</span>
        {totalPages > 1 && (
          <>
            {' · '}
            Seite <span className="font-medium text-zinc-900 dark:text-zinc-100">{page}</span> von{' '}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{totalPages}</span>
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Zurück
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Weiter
        </button>
      </div>
    </nav>
  );
}
