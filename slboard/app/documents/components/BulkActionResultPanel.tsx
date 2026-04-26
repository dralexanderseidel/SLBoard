'use client';

import Link from 'next/link';
import type { BulkActionResultSummary } from '../hooks/useBulkActions';

const MAX_DOC_LINKS = 8;

function DocLinkBlock({
  title,
  docs,
  variant,
  plainTextOnly,
}: {
  title: string;
  docs: { id: string; title: string; message?: string }[];
  variant: 'ok' | 'fail' | 'skip';
  /** Keine Links (z. B. nach Löschung). */
  plainTextOnly?: boolean;
}) {
  if (docs.length === 0) return null;
  const tone =
    variant === 'ok'
      ? 'text-emerald-800 dark:text-emerald-200'
      : variant === 'fail'
        ? 'text-red-800 dark:text-red-200'
        : 'text-amber-800 dark:text-amber-200';
  const shown = docs.slice(0, MAX_DOC_LINKS);
  const more = docs.length - shown.length;

  return (
    <div className="mt-2">
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${tone}`}>{title}</p>
      <ul className="mt-1 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-3 sm:gap-y-1">
        {shown.map((d) => (
          <li key={d.id} className="min-w-0 text-[11px]">
            {plainTextOnly ? (
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                <span className="truncate">{d.title}</span>
              </span>
            ) : (
              <Link
                href={`/documents/${d.id}`}
                className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
              >
                <span className="truncate">{d.title}</span>
              </Link>
            )}
            {d.message ? (
              <span className="ml-1 text-zinc-500 dark:text-zinc-400">({d.message})</span>
            ) : null}
          </li>
        ))}
        {more > 0 ? (
          <li className="text-[11px] text-zinc-500 dark:text-zinc-400">+ {more} weitere</li>
        ) : null}
      </ul>
    </div>
  );
}

export function BulkActionResultPanel({ summary }: { summary: BulkActionResultSummary }) {
  return (
    <section
      className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      role="status"
      aria-live="polite"
    >
      <p className="font-medium text-zinc-800 dark:text-zinc-100">{summary.headline}</p>
      <DocLinkBlock
        title="Erfolgreich"
        docs={summary.okDocs}
        variant="ok"
        plainTextOnly={summary.suppressOkLinks}
      />
      <DocLinkBlock title="Fehlgeschlagen" docs={summary.failedDocs} variant="fail" />
      <DocLinkBlock title="Übersprungen (nicht in der Aktion)" docs={summary.skippedDocs} variant="skip" />
    </section>
  );
}
