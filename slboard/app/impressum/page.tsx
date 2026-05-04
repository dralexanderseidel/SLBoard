import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerSupabaseClient } from '../../lib/supabaseServerClient';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';

export const metadata: Metadata = {
  title: 'Impressum | log/os Edu Governance Pro',
  description: 'Impressum und Anbieterkennzeichnung',
};

export default async function ImpressumPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  return (
    <div className={`${APP_PAGE_MAX_OUTER_CLASS} py-10`}>
      <main className="mx-auto w-full max-w-2xl text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Impressum</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Platzhalter: Angaben gemäß § 5 TMG bzw. § 55 RStV (Anbieter, Anschrift, Kontakt, ggf. Register und
        Umsatzsteuer-ID) und Hinweise auf außergerichtliche Streitbeilegung / EU-Streitschlichtung, soweit
        zutreffend.
      </p>
      <p className="mt-6">
        <Link
          href={user ? '/' : '/login'}
          className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          {user ? 'Zur Startseite' : 'Zur Anmeldung'}
        </Link>
      </p>
    </main>
    </div>
  );
}
