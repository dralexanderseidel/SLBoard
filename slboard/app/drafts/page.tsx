import { Suspense } from 'react';
import { DraftAssistantContent } from './DraftAssistantContent';

export default function DraftAssistantPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
          <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Lade Entwurfsassistent…</p>
          </div>
        </main>
      }
    >
      <DraftAssistantContent />
    </Suspense>
  );
}
