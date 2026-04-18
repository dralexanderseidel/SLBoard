import { Suspense } from 'react';
import { LoginPageClient } from './LoginPageClient';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
          <div className="mx-auto max-w-md px-6 py-12">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Laden…</p>
          </div>
        </main>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}
