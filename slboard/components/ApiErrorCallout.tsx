'use client';

import type { SerializedApiError } from '@/lib/apiUserError';
import { isApiUserError, serializeApiError } from '@/lib/apiUserError';

type Props = {
  /** Roher Fehler, serialisierte API-Fehler oder null (dann nichts rendern). */
  error: unknown | SerializedApiError | null;
  /** Optionaler Kontext über der Nutzermeldung. */
  title?: string;
  className?: string;
};

function normalize(error: unknown | SerializedApiError | null, title?: string): SerializedApiError | null {
  if (error == null) return null;
  if (typeof error === 'string') {
    const t = error.trim();
    return t ? { userMessage: t, detail: null } : null;
  }
  if (typeof error === 'object' && error !== null && 'userMessage' in error) {
    const o = error as SerializedApiError;
    if (typeof o.userMessage === 'string') return o;
  }
  const base = title ? `${title}: unbekannter Fehler` : 'Es ist ein Fehler aufgetreten.';
  if (isApiUserError(error)) return error.toJSON();
  return serializeApiError(error, base);
}

export function ApiErrorCallout({ error, title, className = '' }: Props) {
  const parts = normalize(error, title);
  if (!parts) return null;

  return (
    <div
      role="alert"
      className={`rounded-md border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100 ${className}`}
    >
      {title ? (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-800 dark:text-red-200">{title}</p>
      ) : null}
      <p className="font-medium leading-snug">{parts.userMessage}</p>
      {parts.detail ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none text-red-800/90 underline decoration-red-300 underline-offset-2 hover:text-red-950 dark:text-red-200/90 dark:hover:text-red-50">
            Technische Details
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-red-200/60 bg-white/60 p-2 font-mono text-[11px] text-zinc-800 dark:border-red-900/40 dark:bg-zinc-950/40 dark:text-zinc-200">
            {parts.detail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
