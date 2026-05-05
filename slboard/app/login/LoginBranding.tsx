import Link from 'next/link';
import { LogOsBrandTagline } from '@/components/LogOsBrandTagline';
import { LogOsLogo } from '@/components/LogOsLogo';

/**
 * Servergerendert, außerhalb von Suspense: Logo erscheint sofort, unabhängig von useSearchParams im Formular.
 */
export function LoginBranding() {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-2 pb-6 sm:pb-8">
      <Link
        href="/"
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
      >
        <LogOsLogo priority />
      </Link>
      <LogOsBrandTagline variant="onLight" />
    </div>
  );
}
