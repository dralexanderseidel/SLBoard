import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { createServerSupabaseClient } from '../../lib/supabaseServerClient';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';

export const metadata: Metadata = {
  title: 'Impressum | log/os Edu Governance Pro',
  description: 'Impressum und Anbieterkennzeichnung',
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="mt-3 space-y-3 text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  );
}

/** Wesentliche Laufzeit-Abhängigkeiten (package.json) — für Open-Source-Hinweise im Impressum. */
const OPEN_SOURCE_RUNTIME = [
  { name: 'Next.js', license: 'MIT' },
  { name: 'React / React DOM', license: 'MIT' },
  { name: 'Supabase Client (@supabase/supabase-js, @supabase/ssr)', license: 'MIT' },
  { name: 'Mozilla PDF.js (pdfjs-dist)', license: 'Apache-2.0' },
  { name: 'pdf-parse', license: 'Apache-2.0' },
  { name: 'mammoth (Word-Textextraktion)', license: 'BSD-2-Clause' },
  { name: '@thednp/dommatrix', license: 'MIT' },
  { name: 'Sonner (Benachrichtigungen)', license: 'MIT' },
  { name: 'Tailwind CSS (Build)', license: 'MIT' },
] as const;

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

      <Section id="open-source" title="Open Source">
        <p>
          log/os Edu Governance Pro (SLBoard) nutzt Open-Source-Software. Die Anwendung selbst ist urheberrechtlich
          geschützt; die nachfolgenden Komponenten stehen unter den genannten Lizenzen. Soweit erforderlich (insbesondere
          bei Apache-2.0), werden die Copyright-Hinweise der jeweiligen Projekte beachtet.
        </p>
        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-700">
          <table className="w-full min-w-[20rem] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/80">
                <th className="px-3 py-2 font-semibold text-zinc-800 dark:text-zinc-100">Komponente</th>
                <th className="px-3 py-2 font-semibold text-zinc-800 dark:text-zinc-100">Lizenz</th>
              </tr>
            </thead>
            <tbody>
              {OPEN_SOURCE_RUNTIME.map((row) => (
                <tr key={row.name} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{row.name}</td>
                  <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">{row.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong className="font-semibold text-zinc-800 dark:text-zinc-100">Apache-2.0:</strong> u. a. PDF.js und
          pdf-parse — vollständige Lizenztexte und Copyright-Vermerke finden sich in den jeweiligen npm-Paketen unter{' '}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800">node_modules</code>{' '}
          bzw. auf den Projektseiten der Autoren (Mozilla, npm-Registry).
        </p>
        <p>
          <strong className="font-semibold text-zinc-800 dark:text-zinc-100">BSD-2-Clause:</strong> mammoth — Lizenztext
          im Paket <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800">mammoth</code>.
        </p>
        <p>
          <strong className="font-semibold text-zinc-800 dark:text-zinc-100">MIT:</strong> Die MIT-lizenzierten
          Komponenten dürfen unter Einhaltung der Lizenzbedingungen (Copyright-Hinweis) verwendet werden. Weitere
          transitive Abhängigkeiten können in der Build-Umgebung enthalten sein; maßgeblich ist die produktive
          Dependency-Liste des Deployments.
        </p>
        <p>
          <strong className="font-semibold text-zinc-800 dark:text-zinc-100">Word-Vorschau:</strong> Die Anzeige von
          Word-Dateien im Browser erfolgt optional über den externen Dienst Microsoft Office Online (
          <span className="font-mono text-[11px]">view.officeapps.live.com</span>). Das ist keine in die Anwendung
          eingebundene Open-Source-Bibliothek, sondern ein separater Dienst mit eigenen Nutzungsbedingungen.
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Auf Wunsch können vollständige Lizenztexte der genannten Komponenten beim Betreiber angefordert werden.
        </p>
      </Section>

      <p className="mt-10">
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
