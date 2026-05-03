import React from 'react';
import { steeringListChipFromAnalysis } from '@/lib/steeringAnalysisV2';
import type { DocumentListItem } from './types';

// ── Steering helpers ──────────────────────────────────────────────────────────

export function steeringNeedScore(doc: DocumentListItem): 'low' | 'medium' | 'high' | null {
  const chip = steeringListChipFromAnalysis(doc.steering_analysis);
  if (chip.overallRating === 'robust') return 'low';
  if (chip.overallRating === 'instabil') return 'medium';
  if (chip.overallRating === 'kritisch') return 'high';
  const g = chip.legacyGesamt;
  if (g === 'niedriger Steuerungsbedarf') return 'low';
  if (g === 'mittlerer Steuerungsbedarf') return 'medium';
  if (g === 'hoher Steuerungsbedarf') return 'high';
  return null;
}

export function steeringIconTone(doc: DocumentListItem): string {
  const score = steeringNeedScore(doc);
  if (score === 'low') return 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950';
  if (score === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950';
  if (score === 'high') return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950';
  return 'border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600 dark:hover:bg-zinc-800';
}

export function steeringIconTitle(doc: DocumentListItem): string {
  const chip = steeringListChipFromAnalysis(doc.steering_analysis);
  if (chip.overallRating === 'robust') return 'Steuerungsanalyse vorhanden: robust (strukturell)';
  if (chip.overallRating === 'instabil') return 'Steuerungsanalyse vorhanden: instabil (strukturell)';
  if (chip.overallRating === 'kritisch') return 'Steuerungsanalyse vorhanden: kritisch (strukturell)';
  const score = steeringNeedScore(doc);
  if (score === 'low') return 'Steuerungsanalyse vorhanden: niedriger Steuerungsbedarf';
  if (score === 'medium') return 'Steuerungsanalyse vorhanden: mittlerer Steuerungsbedarf';
  if (score === 'high') return 'Steuerungsanalyse vorhanden: hoher Steuerungsbedarf';
  return 'Steuerungsanalyse fehlt';
}

// ── Reach scope ───────────────────────────────────────────────────────────────

export function reachScopeLabel(scope: DocumentListItem['reach_scope']): string {
  return scope === 'extern' ? 'extern' : 'intern';
}

// ── Participation badges ──────────────────────────────────────────────────────

export function renderParticipationBadges(groups: string[] | null | undefined): React.ReactNode {
  const list = (groups ?? []).map((g) => (g ?? '').trim()).filter(Boolean);
  if (list.length === 0) return <span className="text-zinc-400">—</span>;
  const shown = list.slice(0, 2);
  const rest = list.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((g) => (
        <span
          key={g}
          className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          title={g}
        >
          {g}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          +{rest}
        </span>
      )}
    </div>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function createdDay(iso: string): Date {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

const todayStart = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const yesterdayStart = (): Date => {
  const d = todayStart();
  d.setDate(d.getDate() - 1);
  return d;
};

export function isToday(iso: string): boolean {
  return createdDay(iso).getTime() === todayStart().getTime();
}

export function isYesterday(iso: string): boolean {
  return createdDay(iso).getTime() === yesterdayStart().getTime();
}
