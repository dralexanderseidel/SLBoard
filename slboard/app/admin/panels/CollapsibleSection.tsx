'use client';

import React from 'react';

type Props = {
  title: string;
  description: string;
  open: boolean;
  onToggle: (next: boolean) => void;
  children: React.ReactNode;
};

export function CollapsibleSection({ title, description, open, onToggle, children }: Props) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => onToggle(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
          aria-hidden="true"
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          {children}
        </div>
      )}
    </section>
  );
}
