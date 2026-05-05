'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import type { AdminStats } from '../types';
import { formatStatsDayUtc } from '../types';

type Props = { open: boolean; onToggle: (next: boolean) => void };

function StatCard({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
      {note && <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{note}</p>}
    </div>
  );
}

function QuotaBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  const isWarning = pct >= 80 && pct < 100;
  const isExceeded = pct >= 100;
  const barColor = isExceeded
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-blue-500';
  const textColor = isExceeded
    ? 'text-red-700 dark:text-red-400'
    : isWarning
    ? 'text-amber-700 dark:text-amber-400'
    : 'text-zinc-600 dark:text-zinc-400';

  return (
    <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className={`text-[11px] font-semibold tabular-nums ${textColor}`}>
          {used.toLocaleString('de-DE')} / {max.toLocaleString('de-DE')}
          {isExceeded && ' ⚠ Quota erreicht'}
          {isWarning && ` (${pct} %)`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniBarChart({ days, color }: { days: { date: string; count: number }[]; color: string }) {
  const max = Math.max(1, ...days.map((x) => x.count));
  return (
    <>
      <div className="flex h-36 items-end gap-0.5 border-b border-zinc-200 pb-1 dark:border-zinc-700">
        {days.map((day) => (
          <div
            key={day.date}
            className="group flex min-w-0 flex-1 flex-col items-center justify-end"
            title={`${formatStatsDayUtc(day.date)}: ${day.count}`}
          >
            <span className="mb-0.5 hidden text-[9px] text-zinc-500 group-hover:block dark:text-zinc-400">
              {day.count}
            </span>
            <div
              className={`w-full max-w-[20px] rounded-t ${color}`}
              style={{ height: `${(day.count / max) * 100}%`, minHeight: day.count > 0 ? 4 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 text-[9px] text-zinc-500 dark:text-zinc-400">
        {days.map((day) => (
          <div key={`lbl-${day.date}`} className="min-w-0 flex-1 truncate text-center">
            {day.date.slice(8, 10)}.{day.date.slice(5, 7)}
          </div>
        ))}
      </div>
    </>
  );
}

export function StatsPanel({ open, onToggle }: Props) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Statistik konnte nicht geladen werden.');
      setStats(data as AdminStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Statistik konnte nicht geladen werden.');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const aiQueriesByDay = useMemo(() => stats?.aiQueriesByDay ?? [], [stats]);

  const avg14 = (days: { count: number }[]) =>
    (days.reduce((a, x) => a + x.count, 0) / Math.max(days.length, 1))
      .toLocaleString('de-DE', { maximumFractionDigits: 1 });

  return (
    <CollapsibleSection
      title="Statistik"
      description="Nutzer, Dokumente und KI-Anfragen (letzte 14 Tage nach UTC-Tag)."
      open={open}
      onToggle={onToggle}
    >
      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}
      {loading && !stats && !error && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Lade Statistik…</p>
      )}

      {stats && (
        <>
          <p className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            Zahlen für Ihre Schule ({stats.schoolNumber}).
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Nutzer" value={stats.userCount} />
            <StatCard label="Dokumente gesamt" value={stats.documentTotal} />
            <StatCard label="Aktiv (nicht archiviert)" value={stats.documentActive} />
            <StatCard label="Archiviert" value={stats.documentArchived} />
            <StatCard label="Veröffentlicht" value={stats.documentPublished} />
            <StatCard
              label="KI-API-Aufrufe gesamt"
              value={stats.llmCallsTotal ?? 0}
              note="Jede erfolgreiche LLM-Antwort (Frage, Zusammenfassung, Steuerung, …)"
            />
          </div>

          {/* Quota-Übersicht – nur wenn mind. eine Quota gesetzt ist */}
          {(stats.quotaMaxUsers !== null || stats.quotaMaxDocuments !== null || stats.quotaMaxAiQueriesPerMonth !== null) && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">Quota-Auslastung</p>
              <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-3">
                {stats.quotaMaxUsers !== null && (
                  <QuotaBar label="Nutzer" used={stats.userCount} max={stats.quotaMaxUsers} />
                )}
                {stats.quotaMaxDocuments !== null && (
                  <QuotaBar label="Dokumente" used={stats.documentTotal} max={stats.quotaMaxDocuments} />
                )}
                {stats.quotaMaxAiQueriesPerMonth !== null && (
                  <QuotaBar label="KI-Aufrufe / Monat" used={stats.llmCallsThisMonth} max={stats.quotaMaxAiQueriesPerMonth} />
                )}
              </div>
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                KI-API (letzte 7 Tage, ab UTC-Mitternacht)
              </p>
              <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {stats.llmCallsLast7Days ?? 0}
              </p>
            </div>
            <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Ø pro Tag (14 Tage), KI-API</p>
              <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {avg14(stats.llmCallsByDay ?? [])}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">KI-API-Aufrufe pro Tag (14 Tage)</p>
            <MiniBarChart days={stats.llmCallsByDay ?? []} color="bg-blue-500/80 dark:bg-blue-400/70" />
          </div>

          <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <p className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              Startseite: gespeicherte KI-Anfragen (Verlauf)
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Einträge gesamt</p>
                <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {stats.aiQueriesTotal ?? 0}
                </p>
              </div>
              <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Letzte 7 Tage (UTC)</p>
                <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {stats.aiQueriesLast7Days ?? 0}
                </p>
              </div>
              <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Ø pro Tag (14 Tage)</p>
                <p className="text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {avg14(aiQueriesByDay)}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <p className="mb-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Pro Tag (14 Tage)</p>
              <MiniBarChart days={aiQueriesByDay} color="bg-violet-500/70 dark:bg-violet-400/60" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={loading}
            className="mt-3 rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {loading ? 'Aktualisiere…' : 'Aktualisieren'}
          </button>
        </>
      )}
    </CollapsibleSection>
  );
}
