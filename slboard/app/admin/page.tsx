'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UsersPanel } from './panels/UsersPanel';
import { AiSettingsPanel } from './panels/AiSettingsPanel';
import { PromptPanel } from './panels/PromptPanel';
import { MetadataPanel } from './panels/MetadataPanel';
import { StatsPanel } from './panels/StatsPanel';

export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [adminAllowed, setAdminAllowed] = useState<boolean | null>(null);
  const [usersPanelOpen, setUsersPanelOpen] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [promptPanelOpen, setPromptPanelOpen] = useState(true);
  const [metadataPanelOpen, setMetadataPanelOpen] = useState(true);
  const [statsPanelOpen, setStatsPanelOpen] = useState(true);

  const [reindexLoading, setReindexLoading] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<string | null>(null);
  const [reindexError, setReindexError] = useState<string | null>(null);
  const [reindexMessage, setReindexMessage] = useState<string | null>(null);

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
  }, [searchParams]);

  const setPanelQuery = (next: { users?: boolean; ai?: boolean; prompt?: boolean; meta?: boolean; stats?: boolean }) => {
    const p = new URLSearchParams(searchParams.toString());
    if (typeof next.users === 'boolean') p.set('usersPanel', next.users ? '1' : '0');
    if (typeof next.ai === 'boolean') p.set('aiPanel', next.ai ? '1' : '0');
    if (typeof next.prompt === 'boolean') p.set('promptPanel', next.prompt ? '1' : '0');
    if (typeof next.meta === 'boolean') p.set('metaPanel', next.meta ? '1' : '0');
    if (typeof next.stats === 'boolean') p.set('statsPanel', next.stats ? '1' : '0');
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const handleReindex = async () => {
    const ok = window.confirm(
      'Dokumente neu indizieren?\n\nDies extrahiert Text aus Dateien und setzt search_text/keywords.\nJe nach Anzahl und Dateigröße kann das etwas dauern.'
    );
    if (!ok) return;
    setReindexLoading(true);
    setReindexProgress('Starte…');
    setReindexError(null);
    setReindexMessage(null);
    try {
      let offset = 0;
      let totalOk = 0;
      let totalFailed = 0;
      const limit = 10;
      for (let i = 0; i < 200; i++) {
        setReindexProgress(`Bearbeite Batch ab Offset ${offset}…`);
        const res = await fetch('/api/admin/reindex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset, limit }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Reindex fehlgeschlagen.');
        totalOk += data.ok ?? 0;
        totalFailed += data.failed ?? 0;
        offset = data.nextOffset ?? (offset + limit);
        setReindexProgress(`Fortschritt: ${totalOk} ok, ${totalFailed} Fehler…`);
        if (data.done) break;
      }
      setReindexMessage(`Reindex abgeschlossen. OK: ${totalOk}, Fehler: ${totalFailed}.`);
      setReindexProgress(null);
    } catch (e) {
      setReindexError(e instanceof Error ? e.message : 'Reindex fehlgeschlagen.');
    } finally {
      setReindexLoading(false);
    }
  };

  if (adminAllowed === false) {
    return (
      <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            Kein Zugriff. Bitte melden Sie sich mit einem Admin-Konto an.
          </p>
          <Link href="/" className="mt-4 inline-block text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
            ← Zurück
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">

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
              ← Zurück
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

        <UsersPanel
          open={usersPanelOpen}
          onToggle={(v) => { setUsersPanelOpen(v); setPanelQuery({ users: v }); }}
          onAdminStatusChange={setAdminAllowed}
        />

        {adminAllowed === true && (
          <>
            <AiSettingsPanel
              open={aiPanelOpen}
              onToggle={(v) => { setAiPanelOpen(v); setPanelQuery({ ai: v }); }}
            />
            <PromptPanel
              open={promptPanelOpen}
              onToggle={(v) => { setPromptPanelOpen(v); setPanelQuery({ prompt: v }); }}
            />
            <MetadataPanel
              open={metadataPanelOpen}
              onToggle={(v) => { setMetadataPanelOpen(v); setPanelQuery({ meta: v }); }}
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
