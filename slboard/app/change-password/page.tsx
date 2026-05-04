import { Suspense } from 'react';
import { ChangePasswordPageClient } from './ChangePasswordPageClient';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';

export default function ChangePasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
          <div className={`${APP_PAGE_MAX_OUTER_CLASS} py-12`}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Laden…</p>
          </div>
        </main>
      }
    >
      <ChangePasswordPageClient />
    </Suspense>
  );
}
