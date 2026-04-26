import { useState } from 'react';
import { isApiUserError, serializeApiError } from '@/lib/apiUserError';
import { readApiJsonOk } from '@/lib/readApiJson';
import { toastApiError } from '@/lib/toastApiError';
import type { WorkflowStatus } from '@/lib/documentWorkflow';
import type { DocumentListItem } from '../types';

export type BulkResultDocRef = { id: string; title: string };
export type BulkResultFailedDoc = BulkResultDocRef & { message?: string };

export type BulkActionResultSummary = {
  headline: string;
  okDocs: BulkResultDocRef[];
  failedDocs: BulkResultFailedDoc[];
  skippedDocs: BulkResultDocRef[];
  /** Nach Löschung keine `/documents/…`-Links für erfolgreiche Treffer. */
  suppressOkLinks?: boolean;
};

function docTitle(docs: DocumentListItem[], id: string): string {
  return docs.find((d) => d.id === id)?.title ?? id;
}

function skippedRefs(
  selectedIds: string[],
  effectiveIds: string[],
  docs: DocumentListItem[],
): BulkResultDocRef[] {
  return selectedIds
    .filter((id) => !effectiveIds.includes(id))
    .map((id) => ({ id, title: docTitle(docs, id) }));
}

function buildBulkSummary(
  results: PromiseSettledResult<unknown>[],
  effectiveIds: string[],
  selectedIds: string[],
  docs: DocumentListItem[],
  actionPast: string,
): BulkActionResultSummary {
  const okDocs: BulkResultDocRef[] = [];
  const failedDocs: BulkResultFailedDoc[] = [];
  effectiveIds.forEach((id, i) => {
    const title = docTitle(docs, id);
    const r = results[i];
    if (r?.status === 'fulfilled') {
      okDocs.push({ id, title });
    } else {
      const reason = r?.status === 'rejected' ? r.reason : null;
      const message = isApiUserError(reason)
        ? reason.userMessage
        : reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Unbekannter Fehler';
      failedDocs.push({ id, title, message });
    }
  });
  const skippedDocs = skippedRefs(selectedIds, effectiveIds, docs);
  const okCount = okDocs.length;
  const failCount = failedDocs.length;
  const skipCount = skippedDocs.length;
  const n = effectiveIds.length;
  let headline =
    failCount === 0
      ? `${okCount}/${n} Dokument(e) ${actionPast}${skipCount > 0 ? ` · ${skipCount} übersprungen` : ''}.`
      : `${okCount}/${n} ${actionPast} · ${failCount} fehlgeschlagen${skipCount > 0 ? ` · ${skipCount} übersprungen` : ''}.`;
  if (failCount > 0 && failedDocs[0]?.message) {
    headline += ` Erster Fehler: ${failedDocs[0].message}`;
  }
  const suppressOkLinks = actionPast === 'gelöscht';
  return { headline, okDocs, failedDocs, skippedDocs, suppressOkLinks };
}

function buildSummarizeBatchSummary(
  ids: string[],
  selectedIds: string[],
  docs: DocumentListItem[],
  rows: Array<{ documentId: string; ok: boolean; error?: string }> | undefined,
): BulkActionResultSummary {
  const skippedDocs = skippedRefs(selectedIds, ids, docs);
  const okDocs: BulkResultDocRef[] = [];
  const failedDocs: BulkResultFailedDoc[] = [];
  if (rows && rows.length > 0) {
    for (const row of rows) {
      const id = row.documentId;
      const title = docTitle(docs, id);
      if (row.ok) okDocs.push({ id, title });
      else failedDocs.push({ id, title, message: row.error ?? 'Fehler' });
    }
  }
  const okCount = okDocs.length;
  const failCount = failedDocs.length;
  const skipCount = skippedDocs.length;
  const headline =
    failCount === 0
      ? `${okCount}/${ids.length} Dokument(e) mit Zusammenfassung aktualisiert${skipCount > 0 ? ` · ${skipCount} übersprungen` : ''}.`
      : `${okCount}/${ids.length} mit Zusammenfassung aktualisiert · ${failCount} fehlgeschlagen${skipCount > 0 ? ` · ${skipCount} übersprungen` : ''}.`;
  return { headline, okDocs, failedDocs, skippedDocs, suppressOkLinks: false };
}

function errorSummary(message: string): BulkActionResultSummary {
  return { headline: message, okDocs: [], failedDocs: [], skippedDocs: [], suppressOkLinks: false };
}

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
  bulkDeleteResult: BulkActionResultSummary | null;
  bulkUpdateResult: BulkActionResultSummary | null;
  bulkSummarizeResult: BulkActionResultSummary | null;
  bulkSteeringResult: BulkActionResultSummary | null;
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
  const [bulkDeleteResult, setBulkDeleteResult] = useState<BulkActionResultSummary | null>(null);
  const [bulkUpdateResult, setBulkUpdateResult] = useState<BulkActionResultSummary | null>(null);
  const [bulkSummarizeResult, setBulkSummarizeResult] = useState<BulkActionResultSummary | null>(null);
  const [bulkSteeringResult, setBulkSteeringResult] = useState<BulkActionResultSummary | null>(null);
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
      await readApiJsonOk<{ error?: string }>(res, 'Status konnte nicht geändert werden.');
      clearSelection();
      reload();
    } catch (e) {
      toastApiError(e, 'Fehler beim Workflow-Schritt.');
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
      await readApiJsonOk<{ error?: string }>(res, 'Fehler beim Löschen.');
      clearSelection();
      reload();
    } catch (e) {
      toastApiError(e, 'Fehler beim Löschen.');
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
      await readApiJsonOk<{ error?: string }>(res, 'Archivierung fehlgeschlagen.');
      clearSelection();
      reload();
    } catch (e) {
      toastApiError(e, 'Archivierung fehlgeschlagen.');
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
      toastApiError(e, 'Wiederherstellen fehlgeschlagen.');
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
          await readApiJsonOk<{ error?: string }>(res, 'Fehler beim Löschen.');
        }),
      );
      setBulkDeleteResult(buildBulkSummary(results, ids, selectedIds, docs, 'gelöscht'));
      setDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
      clearSelection();
      reload();
    } catch (e) {
      setBulkDeleteResult(errorSummary(serializeApiError(e, 'Bulk-Löschen fehlgeschlagen.').userMessage));
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
          await readApiJsonOk<{ error?: string }>(res, 'Archivierung fehlgeschlagen.');
        }),
      );
      setBulkDeleteResult(buildBulkSummary(results, ids, selectedIds, docs, 'ins Archiv gelegt'));
      setDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
      clearSelection();
      reload();
    } catch (e) {
      setBulkDeleteResult(errorSummary(serializeApiError(e, 'Bulk-Archivierung fehlgeschlagen.').userMessage));
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
          await readApiJsonOk<{ error?: string }>(res, 'Wiederherstellen fehlgeschlagen.');
        }),
      );
      setBulkDeleteResult(buildBulkSummary(results, ids, selectedIds, docs, 'wiederhergestellt'));
      setDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
      clearSelection();
      reload();
    } catch (e) {
      setBulkDeleteResult(errorSummary(serializeApiError(e, 'Bulk-Wiederherstellen fehlgeschlagen.').userMessage));
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
          await readApiJsonOk<{ error?: string }>(res, 'Fehler beim Statuswechsel.');
        }),
      );
      setBulkUpdateResult(buildBulkSummary(results, ids, selectedIds, docs, 'aktualisiert (Status)'));
      clearSelection();
      reload();
    } catch (e) {
      setBulkUpdateResult(errorSummary(serializeApiError(e, 'Bulk-Statuswechsel fehlgeschlagen.').userMessage));
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
          await readApiJsonOk<{ error?: string }>(res, 'Fehler beim Schutzklassenwechsel.');
        }),
      );
      setBulkUpdateResult(buildBulkSummary(results, ids, selectedIds, docs, 'aktualisiert (Schutzklasse)'));
      clearSelection();
      reload();
    } catch (e) {
      setBulkUpdateResult(errorSummary(serializeApiError(e, 'Bulk-Schutzklassenwechsel fehlgeschlagen.').userMessage));
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
          await readApiJsonOk<{ error?: string }>(res, 'Fehler beim Setzen der Reichweite.');
        }),
      );
      setBulkUpdateResult(
        buildBulkSummary(results, ids, selectedIds, docs, `aktualisiert (Reichweite → ${targetScope})`),
      );
      clearSelection();
      reload();
    } catch (e) {
      setBulkUpdateResult(errorSummary(serializeApiError(e, 'Bulk-Update der Reichweite fehlgeschlagen.').userMessage));
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
      const data = await readApiJsonOk<{
        okCount?: number;
        failCount?: number;
        error?: string;
        results?: Array<{ documentId: string; ok: boolean; error?: string }>;
      }>(res, 'Fehler beim Erzeugen der Zusammenfassungen.');
      setBulkSummarizeResult(buildSummarizeBatchSummary(ids, selectedIds, docs, data.results));
      setBulkSummariesArmed(false);
      clearSelection();
      reload();
    } catch (e) {
      setBulkSummarizeResult(errorSummary(serializeApiError(e, 'Bulk-Zusammenfassung fehlgeschlagen.').userMessage));
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
          await readApiJsonOk<{ error?: string }>(res, 'Fehler bei der Steuerungsanalyse.');
        }),
      );
      setBulkSteeringResult(
        buildBulkSummary(results, ids, selectedIds, docs, 'aktualisiert (Steuerungsanalyse)'),
      );
      setBulkSteeringArmed(false);
      clearSelection();
      reload();
    } catch (e) {
      setBulkSteeringResult(errorSummary(serializeApiError(e, 'Bulk-Steuerungsanalyse fehlgeschlagen.').userMessage));
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
