'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function GlobalSearch() {
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

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Dokumente suchen"
      className="flex shrink-0 items-center"
    >
      <div className="relative flex items-center">
        <svg
          className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-400"
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
          className="w-28 rounded-full border border-zinc-200 bg-zinc-50 py-1 pl-7 pr-2 text-xs text-zinc-800 placeholder-zinc-400 transition focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:w-40 md:w-52 md:pr-14 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600"
        />
        <kbd className="pointer-events-none absolute right-2.5 hidden items-center gap-0.5 rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 font-mono text-[9px] text-zinc-400 md:flex dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
          Ctrl K
        </kbd>
      </div>
    </form>
  );
}
