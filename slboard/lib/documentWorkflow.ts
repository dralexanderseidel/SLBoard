/**
 * Dokument-Workflow: Entwurf → In Abstimmung → Beschluss → Veröffentlicht
 * (Status-Spalte `documents.status`, DB-Wert FREIGEGEBEN = „In Abstimmung“.)
 */
export const WORKFLOW_STATUS_ORDER = ['ENTWURF', 'FREIGEGEBEN', 'BESCHLUSS', 'VEROEFFENTLICHT'] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUS_ORDER)[number];

export const WORKFLOW_STATUS_LABEL_DE: Record<string, string> = {
  ENTWURF: 'Entwurf',
  FREIGEGEBEN: 'In Abstimmung',
  BESCHLUSS: 'Beschluss',
  VEROEFFENTLICHT: 'Veröffentlicht',
};

/** Lesbare Workflow-Kette für Hilfetexte (z. B. Dokumentdetail). */
export function workflowOrderDescriptionDe(): string {
  return WORKFLOW_STATUS_ORDER.map((s) => statusLabelDe(s)).join(' → ');
}

export function statusLabelDe(s: string): string {
  return WORKFLOW_STATUS_LABEL_DE[s] ?? s;
}

/** Nur ein Schritt vorwärts erlaubt (PATCH /api/documents/[id]). */
export function allowedNextStatuses(current: string): string[] {
  const idx = WORKFLOW_STATUS_ORDER.indexOf(current as WorkflowStatus);
  if (idx < 0 || idx >= WORKFLOW_STATUS_ORDER.length - 1) return [];
  return [WORKFLOW_STATUS_ORDER[idx + 1]];
}

/** Nächster Schritt für Listenansicht (mit Pfeil-Präfix). */
export function getNextWorkflowTransition(current: string): { next: string; label: string } | null {
  const allowed = allowedNextStatuses(current);
  if (allowed.length === 0) return null;
  const next = allowed[0]!;
  const arrowLabels: Record<string, string> = {
    FREIGEGEBEN: '→ Zur Abstimmung freigeben',
    BESCHLUSS: '→ Beschluss',
    VEROEFFENTLICHT: '→ Veröffentlichen',
  };
  return { next, label: arrowLabels[next] ?? `→ ${statusLabelDe(next)}` };
}

/** Kurztext für den primären Workflow-Button auf der Dokumentdetailseite. */
export function workflowPrimaryButtonLabel(current: string): string | null {
  const t = getNextWorkflowTransition(current);
  if (!t) return null;
  const labels: Record<string, string> = {
    FREIGEGEBEN: 'Zur Abstimmung freigeben',
    BESCHLUSS: 'Beschluss fassen',
    VEROEFFENTLICHT: 'Veröffentlichen',
  };
  return labels[t.next] ?? null;
}

export function isValidWorkflowStatus(s: string): s is WorkflowStatus {
  return (WORKFLOW_STATUS_ORDER as readonly string[]).includes(s);
}

/** Tailwind-Klassen für Status-Pills in Listen- und Kartenansicht */
export function workflowStatusBadgeClass(status: string): string {
  if (status === 'ENTWURF') {
    return 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';
  }
  if (status === 'FREIGEGEBEN') {
    return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200';
  }
  if (status === 'BESCHLUSS') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100';
  }
  if (status === 'VEROEFFENTLICHT') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200';
  }
  return 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200';
}
