import { Suspense } from 'react';
import { DocumentsPageClient } from './DocumentsPageClient';

export default function DocumentsPage() {
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
      <DocumentsPageClient />
    </Suspense>
  );
}
