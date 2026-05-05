import { Suspense } from 'react';
import { LoginBranding } from './LoginBranding';
import { LoginPageClient } from './LoginPageClient';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className={`${APP_PAGE_MAX_OUTER_CLASS} flex flex-col items-center py-12`}>
        <LoginBranding />
        <Suspense
          fallback={
            <div className="flex w-full max-w-md flex-col gap-4">
              <div className="h-36 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">Laden…</p>
            </div>
          }
        >
          <LoginPageClient />
        </Suspense>
      </div>
    </main>
  );
}
