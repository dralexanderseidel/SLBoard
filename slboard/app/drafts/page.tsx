import { Suspense } from 'react';
import { DraftAssistantContent } from './DraftAssistantContent';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';

export default function DraftAssistantPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
          <div className={`${APP_PAGE_MAX_OUTER_CLASS} flex flex-col gap-6 py-6 sm:py-8`}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Lade Entwurfsassistent…</p>
          </div>
        </main>
      }
    >
      <DraftAssistantContent />
    </Suspense>
  );
}
