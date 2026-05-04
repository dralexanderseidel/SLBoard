import { Suspense } from 'react';
import { DocumentDetailPageClient } from './DocumentDetailPageClient';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';

export default function DocumentDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
          <div className={`${APP_PAGE_MAX_OUTER_CLASS} py-6 sm:py-8`}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Laden…</p>
          </div>
        </main>
      }
    >
      <DocumentDetailPageClient />
    </Suspense>
  );
}
