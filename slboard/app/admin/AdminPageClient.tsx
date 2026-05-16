'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UsersPanel } from './panels/UsersPanel';
import { DeleteRequestsPanel } from './panels/DeleteRequestsPanel';
import { AiSettingsPanel } from './panels/AiSettingsPanel';
import { PromptPanel } from './panels/PromptPanel';
import { MetadataPanel } from './panels/MetadataPanel';
import { StatsPanel } from './panels/StatsPanel';
import { useReindex } from './hooks/useReindex';
import { CONTEXT_HELP } from '@/lib/contextHelpUrls';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';

export function AdminPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [adminAllowed, setAdminAllowed] = useState<boolean | null>(null);
  const [usersPanelOpen, setUsersPanelOpen] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [promptPanelOpen, setPromptPanelOpen] = useState(true);
  const [metadataPanelOpen, setMetadataPanelOpen] = useState(true);
  const [statsPanelOpen, setStatsPanelOpen] = useState(true);
  const [deleteRequestsPanelOpen, setDeleteRequestsPanelOpen] = useState(true);
  const [pendingDeleteRequests, setPendingDeleteRequests] = useState(0);

  const { loading: reindexLoading, progress: reindexProgress, error: reindexError, message: reindexMessage, handleReindex } = useReindex();

  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    const read = (key: string, set: (v: boolean) => void) => {
      const val = p.get(key);
      if (val === '0' || val === '1') set(val === '1');
    };
    read('usersPanel', setUsersPanelOpen);
    read('aiPanel', setAiPanelOpen);
    read('promptPanel', setPromptPanelOpen);
    read('metaPanel', setMetadataPanelOpen);
    read('statsPanel', setStatsPanelOpen);
    read('deleteRequestsPanel', setDeleteRequestsPanelOpen);
  }, [searchParams]);

  const setPanelQuery = (next: {
    users?: boolean;
    ai?: boolean;
    prompt?: boolean;
    meta?: boolean;
    stats?: boolean;
    deleteRequests?: boolean;
  }) => {
    const p = new URLSearchParams(searchParams.toString());
    if (typeof next.users === 'boolean') p.set('usersPanel', next.users ? '1' : '0');
    if (typeof next.ai === 'boolean') p.set('aiPanel', next.ai ? '1' : '0');
    if (typeof next.prompt === 'boolean') p.set('promptPanel', next.prompt ? '1' : '0');
    if (typeof next.meta === 'boolean') p.set('metaPanel', next.meta ? '1' : '0');
    if (typeof next.stats === 'boolean') p.set('statsPanel', next.stats ? '1' : '0');
    if (typeof next.deleteRequests === 'boolean') {
      p.set('deleteRequestsPanel', next.deleteRequests ? '1' : '0');
    }
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  if (adminAllowed === false) {
    return (
      <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className={`${APP_PAGE_MAX_OUTER_CLASS} py-6 sm:py-8`}>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            Kein Zugriff. Bitte melden Sie sich mit einem Admin-Konto an.
          </p>
          <Link href="/" className="mt-4 inline-block text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
            ← Zur Startseite
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className={`${APP_PAGE_MAX_OUTER_CLASS} flex flex-col gap-6 py-6 sm:py-8`}>

        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold">Admin</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Benutzer & Rollen verwalten, KI-Konfiguration pflegen und Metadaten-Listen pro Schule bearbeiten.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {adminAllowed === true && (
              <button
                type="button"
                onClick={() => void handleReindex()}
                disabled={reindexLoading}
                className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
                title="search_text/keywords für bestehende Dokumente neu erzeugen"
              >
                {reindexLoading ? 'Reindex läuft…' : 'Dokumente reindizieren'}
              </button>
            )}
            <Link href="/" className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
              ← Zur Startseite
            </Link>
          </div>
        </header>

        {reindexProgress && (
          <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            {reindexProgress}
          </p>
        )}
        {reindexError && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {reindexError}
          </p>
        )}
        {reindexMessage && (
          <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
            {reindexMessage}
          </p>
        )}

        <section
          aria-labelledby="admin-first-steps-heading"
          className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="admin-first-steps-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Erste Schritte
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Sinnvolle Reihenfolge auf dieser Seite: Zuerst <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              Nutzer
            </strong>{' '}
            (Zugänge, Rollen, Organisationseinheiten). Danach <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              Metadaten
            </strong>{' '}
            (Dokumenttypen, Verantwortlich) — sie speisen Auswahllisten beim Upload und sollten zu den Org.-Einheiten der
            Nutzer passen. Anschließend <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              KI-Einstellungen
            </strong>{' '}
            und <strong className="font-medium text-zinc-800 dark:text-zinc-200">Prompt-Vorlagen</strong>, wenn die
            KI-Nutzung starten soll. <strong className="font-medium text-zinc-800 dark:text-zinc-200">Statistik</strong>{' '}
            bietet Kennzahlen; <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              Dokumente reindizieren
            </strong>{' '}
            nur nach größeren Konfigurationsänderungen.
          </p>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Ausführliche Erläuterungen und Hinweise:{' '}
            <Link
              href={CONTEXT_HELP.admin}
              className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
            >
              Hilfe → Bereich Admin
            </Link>
            .
          </p>
        </section>

        <UsersPanel
          open={usersPanelOpen}
          onToggle={(v) => { setUsersPanelOpen(v); setPanelQuery({ users: v }); }}
          onAdminStatusChange={setAdminAllowed}
        />

        {adminAllowed === true && (
          <>
            <DeleteRequestsPanel
              open={deleteRequestsPanelOpen}
              onToggle={(v) => {
                setDeleteRequestsPanelOpen(v);
                setPanelQuery({ deleteRequests: v });
              }}
              onPendingCount={setPendingDeleteRequests}
            />
            <MetadataPanel
              open={metadataPanelOpen}
              onToggle={(v) => { setMetadataPanelOpen(v); setPanelQuery({ meta: v }); }}
            />
            <AiSettingsPanel
              open={aiPanelOpen}
              onToggle={(v) => { setAiPanelOpen(v); setPanelQuery({ ai: v }); }}
            />
            <PromptPanel
              open={promptPanelOpen}
              onToggle={(v) => { setPromptPanelOpen(v); setPanelQuery({ prompt: v }); }}
            />
            <StatsPanel
              open={statsPanelOpen}
              onToggle={(v) => { setStatsPanelOpen(v); setPanelQuery({ stats: v }); }}
            />
          </>
        )}
      </div>
    </main>
  );
}
