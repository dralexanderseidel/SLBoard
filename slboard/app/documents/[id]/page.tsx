import { Suspense } from 'react';
import { DocumentDetailPageClient } from './DocumentDetailPageClient';

export default function DocumentDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
          <div className="mx-auto max-w-5xl px-6 py-8">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Laden…</p>
          </div>
        </main>
      }
    >
      <DocumentDetailPageClient />
    </Suspense>
  );
}
