import { useState } from 'react';
import { readApiJson } from '@/lib/readApiJson';
import type { WorkflowStatus } from '@/lib/documentWorkflow';
import type { DocumentListItem } from '../types';

type BulkActionDeps = {
  docs: DocumentListItem[];
  selectedIds: string[];
  editableSelectedIds: string[];
  setDocs: React.Dispatch<React.SetStateAction<DocumentListItem[]>>;
  clearSelection: () => void;
  reload: () => void;
  cancelInFlight: () => void;
};

export type BulkActionsResult = {
  bulkDeleting: boolean;
  bulkArchiving: boolean;
  bulkUpdating: boolean;
  bulkSummarizing: boolean;
  bulkSteeringAnalyzing: boolean;
  bulkSummariesArmed: boolean;
  bulkSteeringArmed: boolean;
  setBulkSummariesArmed: (v: boolean) => void;
  setBulkSteeringArmed: (v: boolean) => void;
  bulkDeleteResult: string | null;
  bulkUpdateResult: string | null;
  bulkSummarizeResult: string | null;
  bulkSteeringResult: string | null;
  clearAllResults: () => void;
  rowActionLoadingId: string | null;
  /** Combined busy flag for row-level UI disabling */
  isBusy: boolean;
  handleBulkDelete: () => Promise<void>;
  handleBulkArchive: () => Promise<void>;
  handleBulkRestore: () => Promise<void>;
  handleBulkSetStatus: (status: WorkflowStatus) => Promise<void>;
  handleBulkSetProtectionClass: (classId: 1 | 2 | 3) => Promise<void>;
  handleBulkSetReachScope: (scope: 'intern' | 'extern') => Promise<void>;
  handleBulkGenerateSummaries: () => Promise<void>;
  handleBulkGenerateSteeringAnalyses: () => Promise<void>;
  handleRowWorkflowStep: (documentId: string, newStatus: string) => Promise<void>;
  handleRowDelete: (documentId: string) => Promise<void>;
  handleRowArchive: (documentId: string) => Promise<void>;
  handleRowRestore: (documentId: string) => Promise<void>;
};

function buildBulkResult(
  results: PromiseSettledResult<unknown>[],
  totalSelected: number,
  editableCount: number,
  actionLabel: string,
): string {
  const okCount = results.filter((r) => r.status === 'fulfilled').length;
  const failCount = results.length - okCount;
  const skippedCount = totalSelected - editableCount;
  const firstFail = results.find((r) => r.status === 'rejected');
  const failText =
    firstFail && firstFail.status === 'rejected'
      ? firstFail.reason instanceof Error
        ? firstFail.reason.message
        : String(firstFail.reason)
      : null;
  return failCount === 0
    ? `${okCount}/${results.length} Dokument(e) ${actionLabel}${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.`
    : `${okCount}/${results.length} ${actionLabel}, ${failCount} fehlgeschlagen${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.${failText ? ` Grund: ${failText}` : ''}`;
}

export function useBulkActions({
  docs,
  selectedIds,
  editableSelectedIds,
  setDocs,
  clearSelection,
  reload,
  cancelInFlight,
}: BulkActionDeps): BulkActionsResult {
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkSummarizing, setBulkSummarizing] = useState(false);
  const [bulkSteeringAnalyzing, setBulkSteeringAnalyzing] = useState(false);
  const [bulkSummariesArmed, setBulkSummariesArmed] = useState(false);
  const [bulkSteeringArmed, setBulkSteeringArmed] = useState(false);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<string | null>(null);
  const [bulkUpdateResult, setBulkUpdateResult] = useState<string | null>(null);
  const [bulkSummarizeResult, setBulkSummarizeResult] = useState<string | null>(null);
  const [bulkSteeringResult, setBulkSteeringResult] = useState<string | null>(null);
  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(null);

  const bulkAiBusy = bulkSummarizing || bulkSteeringAnalyzing;
  const isBusy = bulkDeleting || bulkArchiving || bulkUpdating || bulkAiBusy;

  const clearAllResults = () => {
    setBulkDeleteResult(null);
    setBulkUpdateResult(null);
    setBulkSummarizeResult(null);
    setBulkSteeringResult(null);
  };

  const effectiveIds = () =>
    editableSelectedIds.length > 0 ? [...editableSelectedIds] : [...selectedIds];

  // ── Row actions ──────────────────────────────────────────────────────────────

  const handleRowWorkflowStep = async (documentId: string, newStatus: string) => {
    if (isBusy || rowActionLoadingId) return;
    setRowActionLoadingId(documentId);
    clearAllResults();
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Status konnte nicht geändert werden.');
      clearSelection();
      reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Fehler beim Workflow-Schritt.');
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleRowDelete = async (documentId: string) => {
    if (isBusy || rowActionLoadingId) return;
    const title = docs.find((d) => d.id === documentId)?.title ?? documentId;
    const ok = window.confirm(
      `Dokument endgültig löschen?\n\n${title}\n\nDateien und gespeicherte KI-Anfragen, die nur dieses Dokument betreffen, werden entfernt. Dieser Vorgang kann nicht rückgängig gemacht werden.`,
    );
    if (!ok) return;
    setRowActionLoadingId(documentId);
    clearAllResults();
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Löschen.');
      clearSelection();
      reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Fehler beim Löschen.');
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleRowArchive = async (documentId: string) => {
    if (isBusy || rowActionLoadingId) return;
    const title = docs.find((d) => d.id === documentId)?.title ?? documentId;
    const ok = window.confirm(
      `Dokument ins Archiv legen?\n\n${title}\n\nEs erscheint nicht mehr in der normalen Liste. Gespeicherte KI-Anfragen mit Verweis auf dieses Dokument bleiben nutzbar.`,
    );
    if (!ok) return;
    setRowActionLoadingId(documentId);
    clearAllResults();
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Archivierung fehlgeschlagen.');
      clearSelection();
      reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Archivierung fehlgeschlagen.');
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const handleRowRestore = async (documentId: string) => {
    if (isBusy || rowActionLoadingId) return;
    const title = docs.find((d) => d.id === documentId)?.title ?? documentId;
    const ok = window.confirm(`Dokument aus dem Archiv wiederherstellen?\n\n${title}`);
    if (!ok) return;
    setRowActionLoadingId(documentId);
    clearAllResults();
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Wiederherstellen fehlgeschlagen.');
      clearSelection();
      reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Wiederherstellen fehlgeschlagen.');
    } finally {
      setRowActionLoadingId(null);
    }
  };

  // ── Bulk actions ─────────────────────────────────────────────────────────────

  const handleBulkDelete = async () => {
    const ids = effectiveIds();
    if (ids.length === 0) return;
    const confirmText =
      ids.length === 1
        ? `Dokument endgültig löschen?\n\n${docs.find((d) => d.id === ids[0])?.title ?? ids[0]}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`
        : `Ausgewählte Dokumente wirklich löschen?\n\nAnzahl: ${ids.length}\nDieser Vorgang kann nicht rückgängig gemacht werden.`;
    if (!window.confirm(confirmText)) return;

    setBulkDeleting(true);
    clearAllResults();
    cancelInFlight();
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Fehler beim Löschen.');
        }),
      );
      setBulkDeleteResult(buildBulkResult(results, selectedIds.length, ids.length, 'gelöscht'));
      setDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
      clearSelection();
      reload();
    } catch (e) {
      setBulkDeleteResult(e instanceof Error ? e.message : 'Bulk-Löschen fehlgeschlagen.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkArchive = async () => {
    const ids = effectiveIds();
    if (ids.length === 0) return;
    const ok = window.confirm(
      ids.length === 1
        ? `Ausgewähltes Dokument ins Archiv legen?\n\n${docs.find((d) => d.id === ids[0])?.title ?? ids[0]}`
        : `${ids.length} Dokumente ins Archiv legen?\n\nSie erscheinen nicht mehr in der normalen Liste; KI-Verweise bleiben gültig.`,
    );
    if (!ok) return;

    setBulkArchiving(true);
    clearAllResults();
    cancelInFlight();
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/documents/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archived: true }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Archivierung fehlgeschlagen.');
        }),
      );
      setBulkDeleteResult(buildBulkResult(results, selectedIds.length, ids.length, 'ins Archiv gelegt'));
      setDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
      clearSelection();
      reload();
    } catch (e) {
      setBulkDeleteResult(e instanceof Error ? e.message : 'Bulk-Archivierung fehlgeschlagen.');
    } finally {
      setBulkArchiving(false);
    }
  };

  const handleBulkRestore = async () => {
    const ids = effectiveIds();
    if (ids.length === 0) return;
    const ok = window.confirm(
      ids.length === 1
        ? `Dokument aus dem Archiv wiederherstellen?\n\n${docs.find((d) => d.id === ids[0])?.title ?? ids[0]}`
        : `${ids.length} Dokumente aus dem Archiv wiederherstellen?`,
    );
    if (!ok) return;

    setBulkArchiving(true);
    clearAllResults();
    cancelInFlight();
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/documents/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archived: false }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Wiederherstellen fehlgeschlagen.');
        }),
      );
      setBulkDeleteResult(buildBulkResult(results, selectedIds.length, ids.length, 'wiederhergestellt'));
      setDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
      clearSelection();
      reload();
    } catch (e) {
      setBulkDeleteResult(e instanceof Error ? e.message : 'Bulk-Wiederherstellen fehlgeschlagen.');
    } finally {
      setBulkArchiving(false);
    }
  };

  const handleBulkSetStatus = async (targetStatus: WorkflowStatus) => {
    const ids = effectiveIds();
    if (ids.length === 0) return;

    setBulkUpdating(true);
    clearAllResults();
    cancelInFlight();
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/documents/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: targetStatus }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Fehler beim Statuswechsel.');
        }),
      );
      setBulkUpdateResult(buildBulkResult(results, selectedIds.length, ids.length, 'aktualisiert (Status)'));
      clearSelection();
      reload();
    } catch (e) {
      setBulkUpdateResult(e instanceof Error ? e.message : 'Bulk-Statuswechsel fehlgeschlagen.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkSetProtectionClass = async (targetClassId: 1 | 2 | 3) => {
    const ids = effectiveIds();
    if (ids.length === 0) return;

    setBulkUpdating(true);
    clearAllResults();
    cancelInFlight();
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/documents/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ protection_class_id: targetClassId }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Fehler beim Schutzklassenwechsel.');
        }),
      );
      setBulkUpdateResult(buildBulkResult(results, selectedIds.length, ids.length, 'aktualisiert (Schutzklasse)'));
      clearSelection();
      reload();
    } catch (e) {
      setBulkUpdateResult(e instanceof Error ? e.message : 'Bulk-Schutzklassenwechsel fehlgeschlagen.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkSetReachScope = async (targetScope: 'intern' | 'extern') => {
    const ids = effectiveIds();
    if (ids.length === 0) return;

    setBulkUpdating(true);
    clearAllResults();
    cancelInFlight();
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/documents/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reach_scope: targetScope }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? 'Fehler beim Setzen der Reichweite.');
        }),
      );
      setBulkUpdateResult(
        buildBulkResult(results, selectedIds.length, ids.length, `aktualisiert (Reichweite → ${targetScope})`),
      );
      clearSelection();
      reload();
    } catch (e) {
      setBulkUpdateResult(e instanceof Error ? e.message : 'Bulk-Update der Reichweite fehlgeschlagen.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkGenerateSummaries = async () => {
    if (!bulkSummariesArmed) return;
    const ids = effectiveIds();
    if (ids.length === 0) return;

    if (!window.confirm(`KI-Zusammenfassung für ${ids.length} Dokument(e) erzeugen?\n\nDas kann je nach Dokumentenlänge dauern.`)) return;

    setBulkSummarizing(true);
    clearAllResults();
    cancelInFlight();
    try {
      const res = await fetch('/api/summarize-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ documentIds: ids }),
      });
      const data = await readApiJson<{ okCount?: number; failCount?: number; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Erzeugen der Zusammenfassungen.');
      const okCount = data.okCount ?? 0;
      const failCount = data.failCount ?? (ids.length - okCount);
      const skippedCount = selectedIds.length - ids.length;
      setBulkSummarizeResult(
        failCount === 0
          ? `${okCount}/${ids.length} Dokument(e) aktualisiert (Zusammenfassung)${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.`
          : `${okCount}/${ids.length} aktualisiert (Zusammenfassung), ${failCount} fehlgeschlagen${skippedCount > 0 ? `, ${skippedCount} übersprungen` : ''}.`,
      );
      setBulkSummariesArmed(false);
      clearSelection();
      reload();
    } catch (e) {
      setBulkSummarizeResult(e instanceof Error ? e.message : 'Bulk-Zusammenfassung fehlgeschlagen.');
    } finally {
      setBulkSummarizing(false);
    }
  };

  const handleBulkGenerateSteeringAnalyses = async () => {
    if (!bulkSteeringArmed) return;
    const ids = effectiveIds();
    if (ids.length === 0) return;

    if (!window.confirm(`KI-Steuerungsanalyse für ${ids.length} Dokument(e) erzeugen?\n\nDas kann je nach Dokumentenlänge dauern.`)) return;

    setBulkSteeringAnalyzing(true);
    clearAllResults();
    cancelInFlight();
    try {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/documents/${id}/steering-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ force: true }),
          });
          const data = await readApiJson<{ error?: string }>(res);
          if (!res.ok) throw new Error(data.error ?? 'Fehler bei der Steuerungsanalyse.');
        }),
      );
      setBulkSteeringResult(buildBulkResult(results, selectedIds.length, ids.length, 'aktualisiert (Steuerungsanalyse)'));
      setBulkSteeringArmed(false);
      clearSelection();
      reload();
    } catch (e) {
      setBulkSteeringResult(e instanceof Error ? e.message : 'Bulk-Steuerungsanalyse fehlgeschlagen.');
    } finally {
      setBulkSteeringAnalyzing(false);
    }
  };

  return {
    bulkDeleting,
    bulkArchiving,
    bulkUpdating,
    bulkSummarizing,
    bulkSteeringAnalyzing,
    bulkSummariesArmed,
    bulkSteeringArmed,
    setBulkSummariesArmed,
    setBulkSteeringArmed,
    bulkDeleteResult,
    bulkUpdateResult,
    bulkSummarizeResult,
    bulkSteeringResult,
    clearAllResults,
    rowActionLoadingId,
    isBusy,
    handleBulkDelete,
    handleBulkArchive,
    handleBulkRestore,
    handleBulkSetStatus,
    handleBulkSetProtectionClass,
    handleBulkSetReachScope,
    handleBulkGenerateSummaries,
    handleBulkGenerateSteeringAnalyses,
    handleRowWorkflowStep,
    handleRowDelete,
    handleRowArchive,
    handleRowRestore,
  };
}
