'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function GlobalSearch({ variant = 'header' }: { variant?: 'header' | 'sidebar' }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts: Ctrl+K / ⌘+K focusses the search bar,
  // "/" when no input element is focused also triggers it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key === '/' && !isEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = value.trim();
      if (!q) {
        inputRef.current?.blur();
        return;
      }
      router.push(`/documents?q=${encodeURIComponent(q)}`);
      setValue('');
    },
    [value, router],
  );

  const isSidebar = variant === 'sidebar';
  const formClass = isSidebar
    ? 'flex w-full min-w-0 flex-col'
    : 'flex w-full min-w-0 items-center md:w-auto md:shrink-0';
  const wrapClass = isSidebar ? 'relative flex w-full min-w-0' : 'relative flex w-full min-w-0 items-center md:w-auto';
  const iconClass = isSidebar
    ? 'pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400'
    : 'pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-400';
  const inputClass = isSidebar
    ? 'min-w-0 w-full rounded-lg border border-slate-600 bg-slate-800 py-2 pl-8 pr-2 text-xs text-slate-100 placeholder-slate-500 transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
    : 'min-w-0 w-full rounded-full border border-zinc-200 bg-zinc-50 py-1 pl-7 pr-2 text-xs text-zinc-800 placeholder-zinc-400 transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 md:w-52 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600';

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Dokumente suchen"
      className={formClass}
    >
      <div className={wrapClass}>
        <svg
          className={iconClass}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
            clipRule="evenodd"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Suchen …"
          aria-label="Dokumente suchen"
          className={inputClass}
        />
      </div>
    </form>
  );
}
