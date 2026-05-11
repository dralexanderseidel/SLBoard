'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  WORKFLOW_STATUS_ORDER,
  getNextWorkflowTransition,
  statusLabelDe,
  workflowPrimaryButtonLabel,
  workflowStatusBadgeClass,
  type WorkflowStatus,
} from '@/lib/documentWorkflow';
import {
  auditMetadataFieldLabelDe,
  auditValuesEqual,
  formatAuditScalarDe,
} from '@/lib/auditDiff';
import {
  DEFAULT_SCHOOL_DOC_TYPES,
  DEFAULT_ORG_UNIT_NAMES,
  PARTICIPATION_GROUP_OPTIONS,
  docTypeLabelDe,
} from '@/lib/documentMeta';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';
import { useDocumentDetail } from './hooks/useDocumentDetail';
import { useDocumentPreview } from './hooks/useDocumentPreview';
import { useDocumentSummary } from './hooks/useDocumentSummary';
import { useDocumentSteering } from './hooks/useDocumentSteering';
import { useDocumentAsk } from './hooks/useDocumentAsk';
import { useDocumentMetadataOptions } from './hooks/useDocumentMetadataOptions';
import { SteeringAnalysisPanel } from './SteeringAnalysisPanel';
import { ApiErrorCallout } from '@/components/ApiErrorCallout';
import { LONG_RUNNING_EXPECTATION_HINT } from '@/lib/longRunningExpectationHint';
import { schulentwicklungFieldLabelDe } from '@/lib/steeringAnalysisV2';
import type { SteeringAnalysis } from '@/lib/steeringAnalysisV2';
import { CONTEXT_HELP } from '@/lib/contextHelpUrls';
import { ContextHelpLink } from '@/components/ContextHelpLink';
import { useHeaderAccess } from '@/components/HeaderAccessContext';
import { CollapsibleSection } from '@/app/admin/panels/CollapsibleSection';
import type { AuditEntry, DocumentDetail } from './types';
import { DocumentCommentsPanel } from './DocumentCommentsPanel';

// ── Reine Hilfsfunktionen (kein Component-State) ─────────────────────────────

function whoLabel(email: string) {
  const base = (email ?? '').trim();
  if (!base) return 'Unbekannt';
  const local = base.split('@')[0] ?? base;
  return local.replace(/[._-]+/g, ' ').trim() || base;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function auditBucketLabel(iso: string) {
  const ts = new Date(iso);
  const day = startOfDay(ts);
  const today = startOfDay(new Date());
  const diffDays = Math.floor((today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Gestern';
  if (diffDays >= 2 && diffDays <= 7) return 'Letzte 7 Tage';
  return 'Älter';
}

function isImportantAuditEntry(entry: AuditEntry) {
  if (entry.action === 'version.upload') return false;
  if (entry.action !== 'document.update') return false;
  const oldVals = entry.old_values ?? {};
  const newVals = entry.new_values ?? {};
  if (
    Object.prototype.hasOwnProperty.call(newVals, 'status') &&
    !auditValuesEqual(oldVals.status, newVals.status)
  ) {
    return true;
  }
  if (
    Object.prototype.hasOwnProperty.call(newVals, 'archived_at') &&
    !auditValuesEqual(oldVals.archived_at, newVals.archived_at)
  ) {
    return true;
  }
  return false;
}

function formatAuditSummary(entry: AuditEntry): string {
  const who = whoLabel(entry.user_email);
  const oldVals = entry.old_values ?? {};
  const newVals = entry.new_values ?? {};

  if (entry.action === 'version.upload') {
    const vn = (entry.new_values as { version_number?: string } | null)?.version_number;
    return vn ? `${who} hat eine neue Version (${vn}) hochgeladen.` : `${who} hat eine neue Version hochgeladen.`;
  }

  if (entry.action === 'document.update') {
    const changes: string[] = [];

    if (Object.prototype.hasOwnProperty.call(newVals, 'status')) {
      if (!auditValuesEqual(oldVals.status, newVals.status)) {
        const from = typeof oldVals.status === 'string' ? statusLabelDe(oldVals.status) : '—';
        const to = typeof newVals.status === 'string' ? statusLabelDe(newVals.status) : '—';
        changes.push(`Status von „${from}" zu „${to}" geändert`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(newVals, 'title')) {
      if (!auditValuesEqual(oldVals.title, newVals.title)) {
        const from = formatAuditScalarDe('title', oldVals.title);
        const to = formatAuditScalarDe('title', newVals.title);
        changes.push(`Titel von „${from}" zu „${to}" geändert`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(newVals, 'archived_at')) {
      if (!auditValuesEqual(oldVals.archived_at, newVals.archived_at)) {
        const hadArchive = oldVals.archived_at != null && String(oldVals.archived_at).length > 0;
        const hasArchive = newVals.archived_at != null && String(newVals.archived_at).length > 0;
        if (hasArchive && !hadArchive) {
          changes.push('dieses Dokument ins Archiv gelegt');
        } else if (!hasArchive && hadArchive) {
          changes.push('dieses Dokument aus dem Archiv wiederhergestellt');
        } else {
          changes.push(
            `„${auditMetadataFieldLabelDe('archived_at')}" von „${formatAuditScalarDe('archived_at', oldVals.archived_at)}" zu „${formatAuditScalarDe('archived_at', newVals.archived_at)}" geändert`,
          );
        }
      }
    }

    const otherKeys = Object.keys(newVals).filter(
      (k) => k !== 'status' && k !== 'title' && k !== 'archived_at',
    );
    for (const k of otherKeys.sort()) {
      if (auditValuesEqual(oldVals[k], newVals[k])) continue;
      const label = auditMetadataFieldLabelDe(k);
      const from = formatAuditScalarDe(k, oldVals[k]);
      const to = formatAuditScalarDe(k, newVals[k]);
      changes.push(`„${label}" von „${from}" zu „${to}" geändert`);
    }

    if (changes.length === 0) {
      return `${who} hat Metadaten geändert (ohne erkennbare Feldänderung).`;
    }
    return `${who} hat ${changes.join('; ')}.`;
  }

  return `${who} hat eine Änderung vorgenommen (${entry.action}).`;
}

// ─────────────────────────────────────────────────────────────────────────────

export function DocumentDetailPageClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Kern-Daten ──────────────────────────────────────────────────────────────
  const {
    doc, setDoc,
    loading, error,
    initialVersion,
    allVersions,
    selectedVersionId, setSelectedVersionId,
    auditLog, setAuditLog,
    comments,
    reload,
  } = useDocumentDetail(params?.id);

  const { documentTypeOptions, responsibleUnitOptions } = useDocumentMetadataOptions();
  const docTypeLabel = (code: string) => docTypeLabelDe(code, documentTypeOptions);

  // ── Datei-Vorschau ──────────────────────────────────────────────────────────
  const { version, previewUrl, previewText, previewTextLoading } = useDocumentPreview(
    params?.id,
    selectedVersionId,
    allVersions,
    initialVersion,
  );

  // ── KI-Features ────────────────────────────────────────────────────────────
  const {
    summary, setSummary,
    summaryUpdatedAt, setSummaryUpdatedAt,
    summaryLoading, summaryError,
    handleSummarize,
  } = useDocumentSummary(params?.id, doc, docTypeLabel);

  const {
    steeringAnalysis,
    steeringUpdatedAt,
    steeringLoading, steeringError,
    handleSteeringAnalysis,
    steeringTodos,
    steeringTodosUpdatedAt,
    todosLoading, todosError,
    handleSteeringTodos,
  } = useDocumentSteering(params?.id, doc, setDoc);

  const {
    docQuestionInput, setDocQuestionInput,
    docQuestion, docAnswer, docSources,
    docAskLoading, docAskError,
    handleAskAboutThisDocument,
  } = useDocumentAsk(params?.id, doc);

  const { access, userEmail } = useHeaderAccess();
  const featureAiEnabled = access?.featureAiEnabled !== false;
  const featureDraftsEnabled = access?.featureDraftsEnabled !== false;
  const maxVersionUploadBytes = access?.effectiveMaxUploadBytes ?? 20 * 1024 * 1024;

  // ── Bearbeiten ──────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<DocumentDetail>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editParticipationInput, setEditParticipationInput] = useState('');
  const [responsibleCustom, setResponsibleCustom] = useState(false);

  // ── Version hochladen ───────────────────────────────────────────────────────
  const versionFormRef = useRef<HTMLFormElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);
  const versionFileRef = useRef<File | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [versionFileName, setVersionFileName] = useState<string | null>(null);

  // ── Löschen / Archiv ────────────────────────────────────────────────────────
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // ── Workflow ────────────────────────────────────────────────────────────────
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  // ── Audit-Filter ────────────────────────────────────────────────────────────
  const [auditImportantOnly, setAuditImportantOnly] = useState(false);

  const [kiSummarySectionOpen, setKiSummarySectionOpen] = useState(true);
  const [kiActionsSectionOpen, setKiActionsSectionOpen] = useState(true);

  // ── Scroll-to-section via ?focus= ──────────────────────────────────────────
  const focusParam = searchParams.get('focus');
  useEffect(() => {
    if (focusParam !== 'summary' && focusParam !== 'steering') return;
    if (!doc) return;
    if (focusParam === 'summary') setKiSummarySectionOpen(true);
    if (focusParam === 'steering') setKiActionsSectionOpen(true);
    const t = window.setTimeout(() => {
      const el = document.getElementById(focusParam === 'steering' ? 'steering-section' : 'summary-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [focusParam, doc?.id]);

  // ── Handler ─────────────────────────────────────────────────────────────────

  const handleWorkflowStep = async (newStatus: string) => {
    if (!params?.id || doc?.archived_at) return;
    setWorkflowError(null);
    setWorkflowLoading(true);
    try {
      const res = await fetch(`/api/documents/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Status konnte nicht geändert werden.');
      setDoc((prev) => (prev ? { ...prev, status: newStatus } : null));
      reload();
    } catch (e) {
      setWorkflowError(e instanceof Error ? e.message : 'Fehler beim Status-Wechsel.');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleEdit = () => {
    if (doc) {
      const units =
        responsibleUnitOptions.length > 0 ? responsibleUnitOptions : DEFAULT_ORG_UNIT_NAMES;
      const ru = (doc.responsible_unit ?? '').trim();
      setResponsibleCustom(Boolean(ru) && !units.includes(ru));
      setEditForm({
        title: doc.title,
        legal_reference: doc.legal_reference ?? '',
        gremium: doc.gremium ?? '',
        responsible_unit: doc.responsible_unit,
        reach_scope: doc.reach_scope ?? 'intern',
        participation_groups: doc.participation_groups ?? [],
        document_type_code: doc.document_type_code,
        protection_class_id: doc.protection_class_id,
        review_date: doc.review_date ?? null,
      });
      setIsEditing(true);
      setSaveError(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!params?.id) return;
    setSaveLoading(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/documents/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Speichern.');
      setDoc((prev) => (prev ? { ...prev, ...editForm } : null));
      setIsEditing(false);
      reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Fehler beim Speichern.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleVersionUpload = async () => {
    if (!params?.id) {
      setVersionError('Bitte laden Sie die Seite neu.');
      return;
    }
    const file =
      versionFileRef.current ??
      versionInputRef.current?.files?.[0] ??
      (versionFormRef.current
        ? (new FormData(versionFormRef.current).get('file') as File | null)
        : null);
    if (!file || !(file instanceof File) || file.size === 0) {
      setVersionError('Bitte wählen Sie eine Datei aus.');
      return;
    }
    if (file.size > maxVersionUploadBytes) {
      setVersionError(`Datei zu groß (max. ${Math.round(maxVersionUploadBytes / 1024 / 1024)} MB).`);
      return;
    }
    setVersionLoading(true);
    setVersionError(null);
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await fetch(`/api/documents/${params.id}/version`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Hochladen.');
      versionFileRef.current = null;
      setVersionFileName(null);
      versionFormRef.current?.reset();
      if (versionInputRef.current) versionInputRef.current.value = '';
      setDoc((prev) => (prev ? { ...prev, summary: null, summary_updated_at: null } : null));
      reload();
    } catch (err) {
      setVersionError(err instanceof Error ? err.message : 'Fehler beim Hochladen.');
    } finally {
      setVersionLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/documents');
  };

  const handleDeleteClick = () => setShowDeleteConfirm(true);

  const handleArchiveToVault = async () => {
    if (!params?.id || !doc) return;
    const ok = window.confirm(
      `Dokument „${doc.title}" ins Archiv legen?\n\nEs erscheint nicht mehr in der normalen Liste; gespeicherte KI-Anfragen mit Verweis darauf bleiben nutzbar.`,
    );
    if (!ok) return;
    setArchiveLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/documents/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
      const data = (await res.json()) as {
        error?: string;
        document?: { archived_at?: string | null };
      };
      if (!res.ok) throw new Error(data.error ?? 'Archivierung fehlgeschlagen.');
      if (data.document && 'archived_at' in data.document) {
        setDoc((prev) =>
          prev ? { ...prev, archived_at: data.document!.archived_at ?? null } : null,
        );
      } else {
        reload();
      }
      try {
        const auditRes = await fetch(`/api/documents/${params.id}/audit`);
        const auditJson = (await auditRes.json()) as { data?: typeof auditLog };
        if (auditRes.ok && auditJson.data) setAuditLog(auditJson.data);
      } catch {
        // ignore
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Archivierung fehlgeschlagen.');
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestoreFromVault = async () => {
    if (!params?.id || !doc) return;
    const ok = window.confirm(`Dokument „${doc.title}" aus dem Archiv wiederherstellen?`);
    if (!ok) return;
    setArchiveLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/documents/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      });
      const data = (await res.json()) as {
        error?: string;
        document?: { archived_at?: string | null };
      };
      if (!res.ok) throw new Error(data.error ?? 'Wiederherstellen fehlgeschlagen.');
      if (data.document && 'archived_at' in data.document) {
        setDoc((prev) =>
          prev ? { ...prev, archived_at: data.document!.archived_at ?? null } : null,
        );
      } else {
        reload();
      }
      try {
        const auditRes = await fetch(`/api/documents/${params.id}/audit`);
        const auditJson = (await auditRes.json()) as { data?: typeof auditLog };
        if (auditRes.ok && auditJson.data) setAuditLog(auditJson.data);
      } catch {
        // ignore
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Wiederherstellen fehlgeschlagen.');
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!params?.id) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/documents/${params.id}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Löschen.');
      router.push('/documents');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Fehler beim Löschen.');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  // ── Hilfs-Funktionen ────────────────────────────────────────────────────────

  // ── Audit-Buckets (nur neu berechnen wenn auditLog oder Filter sich ändern) ──
  const auditBuckets = useMemo(() => {
    const sorted = [...auditLog].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const filtered = auditImportantOnly ? sorted.filter(isImportantAuditEntry) : sorted;
    const buckets: Array<{ label: string; items: AuditEntry[] }> = [
      { label: 'Heute', items: [] },
      { label: 'Gestern', items: [] },
      { label: 'Letzte 7 Tage', items: [] },
      { label: 'Älter', items: [] },
    ];
    for (const e of filtered) {
      const label = auditBucketLabel(e.created_at);
      const bucket = buckets.find((b) => b.label === label);
      if (bucket) bucket.items.push(e);
    }
    return { buckets, empty: filtered.length === 0 };
  }, [auditLog, auditImportantOnly]);

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className={`${APP_PAGE_MAX_OUTER_CLASS} flex flex-col gap-6 py-6 sm:py-8`}>
        <header className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="min-w-0 truncate text-xl font-semibold">{doc ? doc.title : 'Dokumentansicht'}</h1>
                {doc && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${workflowStatusBadgeClass(doc.status)}`}
                  >
                    {statusLabelDe(doc.status)}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Detailansicht eines schulischen Dokuments.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <ContextHelpLink href={CONTEXT_HELP.dokumentDetail}>Hilfe zur Dokumentansicht</ContextHelpLink>
                <ContextHelpLink href={CONTEXT_HELP.workflow}>Hilfe zum Workflow</ContextHelpLink>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {doc && (
                <>
                  <a
                    href="#version-upload"
                    className={`rounded border px-3 py-2 text-xs font-medium shadow-sm transition dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 ${
                      doc.archived_at
                        ? 'pointer-events-none border-zinc-200 bg-zinc-100 text-zinc-400 opacity-60 dark:bg-zinc-800 dark:text-zinc-500'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                    aria-disabled={!!doc.archived_at}
                    onClick={(e) => {
                      if (doc.archived_at) e.preventDefault();
                    }}
                  >
                    Neue Version
                  </a>

                  {doc.archived_at ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleRestoreFromVault()}
                        disabled={archiveLoading || deleteLoading}
                        className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                      >
                        {archiveLoading ? '…' : 'Wiederherstellen'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteClick}
                        disabled={archiveLoading || deleteLoading}
                        className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 shadow-sm transition hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
                      >
                        Endgültig löschen
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleArchiveToVault()}
                      disabled={archiveLoading || deleteLoading}
                      className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/40"
                    >
                      {archiveLoading ? '…' : 'Ins Archiv legen'}
                    </button>
                  )}
                </>
              )}

              <span className="mx-1 h-6 border-l border-zinc-200 dark:border-zinc-800" />

              <button
                type="button"
                onClick={handleBack}
                className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
              >
                ← Zur Übersicht
              </button>
              <Link href="/" className="text-xs text-zinc-500 underline-offset-2 hover:underline">
                Startseite
              </Link>
            </div>
          </div>
        </header>

        {loading && <p className="text-sm text-zinc-600 dark:text-zinc-400">Lade Dokument…</p>}
        {error && <ApiErrorCallout error={error} title="Dokument" className="text-sm" />}
        {!loading && !error && !doc && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Dokument wurde nicht gefunden.
          </p>
        )}

        {doc && (
          <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {doc.archived_at && (
              <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                <strong className="font-medium">Archiv:</strong> Dieses Dokument erscheint nicht in der
                normalen Liste. Verweise aus gespeicherten KI-Anfragen funktionieren weiter. Zum Bearbeiten
                oder endgültigen Löschen nutzen Sie die Aktionen oben.
              </div>
            )}
            {/* Linke Spalte: Inhalt / Vorschau */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Inhalt & KI
              </h2>
              {version && (
                <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Version {version.version_number}
                </p>
              )}

              {allVersions.length > 0 && (
                <div className="mb-3 rounded border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <h3 className="mb-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">Versionen</h3>
                  <ul className="space-y-0.5">
                    {allVersions.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedVersionId(v.id)}
                          className={`w-full rounded px-2 py-1 text-left text-[11px] transition ${
                            selectedVersionId === v.id
                              ? 'bg-blue-100 font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                              : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {v.version_number}
                          {v.is_current && ' (aktuell)'}
                          {' · '}
                          {new Date(v.created_at).toLocaleDateString('de-DE')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {previewUrl && version?.mime_type === 'application/pdf' && (
                <div className="mb-3 h-80 overflow-hidden rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950">
                  <iframe
                    src={previewUrl}
                    title={doc.title}
                    className="h-full w-full border-0"
                  />
                </div>
              )}
              {previewUrl &&
                (version?.mime_type ===
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                  version?.mime_type === 'application/msword') && (
                  <div className="mb-3 h-80 overflow-hidden rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950">
                    <iframe
                      src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
                      title={doc.title}
                      className="h-full w-full border-0"
                    />
                  </div>
                )}

              {previewUrl && version?.mime_type === 'text/plain' && (
                <div className="mb-3 max-h-80 overflow-y-auto rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                  <h3 className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    Text-Vorschau
                  </h3>
                  {previewTextLoading ? (
                    <p className="text-xs text-zinc-500">Lade Textvorschau…</p>
                  ) : previewText ? (
                    <pre className="whitespace-pre-wrap text-xs">{previewText}</pre>
                  ) : (
                    <p className="text-xs text-zinc-500">Textvorschau nicht verfügbar.</p>
                  )}
                </div>
              )}

              {!previewUrl && (
                <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Keine Dateivorschau verfügbar.
                </p>
              )}

              <div className="mb-2 rounded border border-zinc-200 bg-zinc-50/80 p-2 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                  {docTypeLabel(doc.document_type_code)}
                </span>
                {doc.responsible_unit && (
                  <>
                    {' '}
                    · Verantwortlich <span className="font-medium">{doc.responsible_unit}</span>
                  </>
                )}
                {doc.gremium && (
                  <>
                    {' '}
                    · Beschlussgremium <span className="font-medium">{doc.gremium}</span>
                  </>
                )}
                {(doc.participation_groups ?? []).length > 0 && (
                  <>
                    {' '}
                    · Beteiligung{' '}
                    <span className="font-medium">{(doc.participation_groups ?? []).join(', ')}</span>
                  </>
                )}
                . Erstelldatum:{' '}
                <span className="font-medium">
                  {new Date(doc.created_at).toLocaleDateString('de-DE')}
                </span>
                .
              </div>

              <div id="summary-section" tabIndex={-1} className="mt-3 scroll-mt-4">
                <CollapsibleSection
                  title="KI-Kurz­zusammenfassung"
                  description={
                    featureAiEnabled
                      ? 'Wird für KI-Suche und KI-Antworten als bevorzugter Kontext genutzt.'
                      : 'Kurzfassung des Dokuments; KI-Erzeugung ist für diese Schule deaktiviert.'
                  }
                  open={kiSummarySectionOpen}
                  onToggle={setKiSummarySectionOpen}
                >
                  <div className="text-xs">
                {!featureAiEnabled && (
                  <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    KI-Funktionen sind für diese Schule deaktiviert. Eine vorhandene Kurzfassung wird weiter angezeigt.
                  </p>
                )}
                {featureAiEnabled && (
                  <>
                    <button
                      type="button"
                      onClick={handleSummarize}
                      disabled={summaryLoading}
                      className="mb-2 inline-flex items-center justify-center rounded bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {summaryLoading
                        ? 'KI fasst zusammen…'
                        : summary && summary.trim().length > 0
                          ? 'Zusammenfassung aktualisieren'
                          : 'Zusammenfassung erzeugen'}
                    </button>
                    {summaryLoading && (
                      <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400" aria-live="polite">
                        {LONG_RUNNING_EXPECTATION_HINT}
                      </p>
                    )}
                  </>
                )}
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Letzte Aktualisierung:{' '}
                  <span className="font-medium">
                    {summaryUpdatedAt
                      ? new Date(summaryUpdatedAt).toLocaleString('de-DE')
                      : '—'}
                  </span>
                </p>
                {summaryError && (
                  <ApiErrorCallout error={summaryError} className="mt-1 text-xs" />
                )}
                {summary && !summaryError && (
                  <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
                    {summary}
                  </p>
                )}
                {featureAiEnabled && !summary && !summaryLoading && !summaryError && (
                  <p className="text-zinc-600 dark:text-zinc-300">
                    Noch keine Zusammenfassung vorhanden. Klicken Sie auf „Zusammenfassung
                    erzeugen", um eine KI-basierte Kurzfassung zu erhalten.
                  </p>
                )}
                {!featureAiEnabled && !summary && !summaryError && (
                  <p className="text-zinc-600 dark:text-zinc-300">Keine Kurz-Zusammenfassung gespeichert.</p>
                )}
                  </div>
                </CollapsibleSection>
              </div>

              <div className="mt-3">
                <CollapsibleSection
                  title="KI-Aktionen"
                  description={
                    featureAiEnabled
                      ? 'Fragen zum Dokument, Steuerungsanalyse und ToDos.'
                      : 'KI-Funktionen sind für diese Schule deaktiviert; bestehende Inhalte bleiben sichtbar.'
                  }
                  open={kiActionsSectionOpen}
                  onToggle={setKiActionsSectionOpen}
                >
                  <div className="text-xs">
                {featureAiEnabled ? (
                <>
                <div className="mb-2">
                  <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                    Fragen zu diesem Dokument
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={docQuestionInput}
                      onChange={(e) => setDocQuestionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleAskAboutThisDocument();
                        }
                      }}
                      placeholder="z. B. Was gilt hier bei …?"
                      className="h-8 w-full rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAskAboutThisDocument()}
                      disabled={docAskLoading || !docQuestionInput.trim()}
                      aria-busy={docAskLoading}
                      className="h-8 shrink-0 whitespace-nowrap rounded bg-blue-600 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {docAskLoading ? 'Anfrage läuft…' : 'fragen'}
                    </button>
                  </div>
                  {docAskLoading && (
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400" aria-live="polite">
                      {LONG_RUNNING_EXPECTATION_HINT}
                    </p>
                  )}
                  {docAskError && <p className="mt-1 text-[11px] text-red-500">{docAskError}</p>}
                </div>

                {docAnswer && (
                  <div className="mt-2 rounded border border-zinc-200 bg-zinc-50/80 p-2 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
                    <p className="mb-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                      Antwort {docQuestion ? `· ${docQuestion}` : ''}
                    </p>
                    <p className="whitespace-pre-wrap">{docAnswer}</p>
                    {docSources.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                          Textbelege
                        </p>
                        <ul className="mt-1 space-y-2">
                          {docSources.map((s) => (
                            <li key={s.documentId} className="text-[11px] rounded border border-zinc-200 bg-white/70 px-2 py-1 dark:border-zinc-800 dark:bg-zinc-900/40">
                              <Link
                                href={`/documents/${s.documentId}`}
                                className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                              >
                                {s.title}
                              </Link>
                              {s.snippet && (
                                <p className="mt-0.5 italic text-zinc-500 dark:text-zinc-400">
                                  &quot;{s.snippet}&quot;
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div id="steering-section" className="mt-3 border-t border-zinc-200 pt-2 text-[11px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                  <button
                    type="button"
                    onClick={() => void handleSteeringAnalysis(Boolean(steeringAnalysis))}
                    disabled={steeringLoading}
                    className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-950"
                  >
                    {steeringLoading
                      ? 'Analyse läuft…'
                      : steeringAnalysis
                        ? 'Analyse des Steuerungsbedarfs aktualisieren'
                        : 'Analyse des Steuerungsbedarfs'}
                  </button>
                  {steeringLoading && (
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400" aria-live="polite">
                      {LONG_RUNNING_EXPECTATION_HINT}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Matrix (7 Aufgabenfelder), drei Steuerungsdimensionen mit 0–100-Scoring, Risiken und
                    strukturelle Verbesserungsvorschläge — Einordnung wird in den Metadaten (Schulentwicklung)
                    gespeichert.
                  </p>
                  {steeringError && <ApiErrorCallout error={steeringError} className="mt-2 text-xs" />}
                  {steeringUpdatedAt && (
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Letzte Analyse: {new Date(steeringUpdatedAt).toLocaleString('de-DE')}
                    </p>
                  )}

                  {steeringAnalysis &&
                  typeof steeringAnalysis === 'object' &&
                  steeringAnalysis !== null &&
                  'overall' in steeringAnalysis ? (
                    <SteeringAnalysisPanel analysis={steeringAnalysis as SteeringAnalysis} />
                  ) : steeringAnalysis ? (
                    <p className="mt-2 rounded border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                      Gespeicherte Analyse nutzt ein älteres Format. Bitte auf{' '}
                      <strong>Analyse des Steuerungsbedarfs aktualisieren</strong> klicken, um die neue Matrix-Auswertung
                      zu erzeugen.
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-start gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSteeringTodos(Boolean(steeringTodos))}
                      disabled={todosLoading}
                      className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-950"
                    >
                      {todosLoading
                        ? 'Extraktion läuft…'
                        : steeringTodos
                          ? 'ToDos/Aufgaben aktualisieren'
                          : 'ToDos/Aufgaben extrahieren'}
                    </button>
                  </div>
                  {todosLoading && (
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400" aria-live="polite">
                      {LONG_RUNNING_EXPECTATION_HINT}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Ermittelt aus dem Dokument konkrete Aufgaben, Fristen und Zuständigkeitshinweise als Liste.
                  </p>
                  {todosError && <ApiErrorCallout error={todosError} className="mt-2 text-xs" />}
                  {steeringTodosUpdatedAt && (
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Letzte Extraktion: {new Date(steeringTodosUpdatedAt).toLocaleString('de-DE')}
                    </p>
                  )}
                  {steeringTodos && steeringTodos.aufgaben.length > 0 && (
                    <div className="mt-2 rounded border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                      <p className="mb-2 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
                        Aufgaben / ToDos
                      </p>
                      <ul className="space-y-2">
                        {steeringTodos.aufgaben.map((a, idx) => (
                          <li
                            key={`${a.titel}-${idx}`}
                            className="rounded border border-zinc-200 bg-white p-2 text-[11px] dark:border-zinc-700 dark:bg-zinc-950"
                          >
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="font-semibold text-zinc-800 dark:text-zinc-100">{a.titel}</span>
                              {a.prioritaet && (
                                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  {a.prioritaet}
                                </span>
                              )}
                            </div>
                            {a.beschreibung && (
                              <p className="mt-1 text-zinc-600 dark:text-zinc-300">{a.beschreibung}</p>
                            )}
                            {(a.verantwortlich_hint || a.frist_hint) && (
                              <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                                {a.verantwortlich_hint && <>Zuständigkeit: {a.verantwortlich_hint}</>}
                                {a.verantwortlich_hint && a.frist_hint && ' · '}
                                {a.frist_hint && <>Frist: {a.frist_hint}</>}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                      {steeringTodos.hinweis && (
                        <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-300">{steeringTodos.hinweis}</p>
                      )}
                    </div>
                  )}
                  {steeringTodos && steeringTodos.aufgaben.length === 0 && !todosError && (
                    <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Keine belastbaren Aufgaben im Dokument gefunden.
                      {steeringTodos.hinweis ? ` ${steeringTodos.hinweis}` : ''}
                    </p>
                  )}
                </div>
                </>
                ) : (
                  <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                    KI-Funktionen sind für diese Schule deaktiviert. Bestehende Analysen und frühere Antworten
                    werden weiterhin angezeigt.
                  </p>
                )}
                  </div>
                </CollapsibleSection>
              </div>

              {featureDraftsEnabled ? (
              <Link
                href={`/drafts?sourceId=${doc.id}&subject=${encodeURIComponent(doc.title)}`}
                className="mt-3 inline-flex items-center justify-center rounded border border-dashed border-zinc-400 px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Entwurf erstellen
              </Link>
              ) : null}
            </div>

            {/* Rechte Spalte: Details + Bearbeiten + Neue Version */}
            <aside className="rounded-lg border border-zinc-200 bg-white p-4 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  Details
                </h2>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    Bearbeiten
                  </button>
                ) : (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={saveLoading}
                      className="rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {saveLoading ? '…' : 'Speichern'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={saveLoading}
                      className="rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      Abbrechen
                    </button>
                  </div>
                )}
              </div>
              {saveError && <ApiErrorCallout error={saveError} className="mb-2 text-xs" />}
              {/* Status & Workflow: Entwurf → Freigegeben → Beschluss → Veröffentlicht */}
              {doc && (
                <div className="mb-3 rounded border border-zinc-200 bg-zinc-50/80 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/50">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-500">Status & Workflow</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${workflowStatusBadgeClass(doc.status)}`}
                    >
                      {statusLabelDe(doc.status)}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="grid grid-cols-4 gap-x-1 gap-y-1 sm:gap-x-2">
                      {(() => {
                        const currentIdx = WORKFLOW_STATUS_ORDER.indexOf(doc.status as WorkflowStatus);
                        return WORKFLOW_STATUS_ORDER.map((step, idx) => {
                        const isActive = doc.status === step;
                        const isDone = currentIdx > idx;
                        const circleBase =
                          'mx-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] leading-none';
                        const activeColors = [
                          'border-zinc-500 bg-zinc-700 text-white',
                          'border-blue-500 bg-blue-600 text-white',
                          'border-amber-500 bg-amber-600 text-white',
                          'border-emerald-500 bg-emerald-600 text-white',
                        ];
                        const activeColor = activeColors[idx] ?? activeColors[0];
                        const doneColor =
                          'border-emerald-400 bg-emerald-500 text-white dark:border-emerald-700 dark:bg-emerald-800';
                        const idleColor =
                          'border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400';

                        const circleClass = isActive
                          ? `${circleBase} ${activeColor}`
                          : isDone
                            ? `${circleBase} ${doneColor}`
                            : `${circleBase} ${idleColor}`;

                        return (
                          <div key={step} className="min-w-0 px-0.5 text-center sm:px-1">
                            <span className={circleClass}>{idx + 1}</span>
                            <span
                              className={`mt-1 block text-balance text-[10px] leading-tight sm:text-[11px] ${
                                isActive
                                  ? 'font-medium text-zinc-900 dark:text-zinc-50'
                                  : 'text-zinc-500 dark:text-zinc-400'
                              }`}
                            >
                              {statusLabelDe(step)}
                            </span>
                          </div>
                        );
                      });
                      })()}
                    </div>
                  </div>

                  {doc.archived_at ? (
                    <p className="text-[11px] text-amber-800 dark:text-amber-200">
                      Archiviert – zum Fortschreiben des Workflows bitte zuerst wiederherstellen.
                    </p>
                  ) : workflowPrimaryButtonLabel(doc.status) && getNextWorkflowTransition(doc.status) ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          handleWorkflowStep(getNextWorkflowTransition(doc.status)!.next)
                        }
                        disabled={workflowLoading}
                        className="w-full rounded bg-blue-600 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {workflowLoading ? '…' : workflowPrimaryButtonLabel(doc.status)}
                      </button>
                      <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                        Der Status wird gemäß definiertem Workflow geändert. Reihenfolge: Entwurf →
                        Freigegeben → Beschluss → Veröffentlicht.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      Dieses Dokument ist bereits veröffentlicht. Weitere Statuswechsel sind nicht
                      vorgesehen.
                    </p>
                  )}

                  {workflowError && <ApiErrorCallout error={workflowError} className="mt-2 text-xs" />}
                </div>
              )}
              {isEditing ? (
                <div className="space-y-2">
                  <div>
                    <label className="mb-0.5 block text-zinc-500">Titel</label>
                    <input
                      type="text"
                      value={editForm.title ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">Typ</label>
                    <select
                      value={editForm.document_type_code ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, document_type_code: e.target.value }))}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                    >
                      {(documentTypeOptions.length > 0
                        ? documentTypeOptions
                        : DEFAULT_SCHOOL_DOC_TYPES
                      ).map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">Verantwortlich</label>
                    {!responsibleCustom ? (
                      <select
                        value={editForm.responsible_unit ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom__') {
                            setResponsibleCustom(true);
                            return;
                          }
                          setEditForm((f) => ({ ...f, responsible_unit: v }));
                        }}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                      >
                        {(responsibleUnitOptions.length > 0 ? responsibleUnitOptions : DEFAULT_ORG_UNIT_NAMES).map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                        <option value="__custom__">Andere… (Freitext)</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editForm.responsible_unit ?? ''}
                          onChange={(e) => setEditForm((f) => ({ ...f, responsible_unit: e.target.value }))}
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                          placeholder="z. B. Fachschaft Musik"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const units =
                              responsibleUnitOptions.length > 0
                                ? responsibleUnitOptions
                                : DEFAULT_ORG_UNIT_NAMES;
                            const cur = (editForm.responsible_unit ?? '').trim();
                            setResponsibleCustom(false);
                            if (!cur || !units.includes(cur)) {
                              setEditForm((f) => ({
                                ...f,
                                responsible_unit: units[0] ?? 'Schulleitung',
                              }));
                            }
                          }}
                          className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                        >
                          Liste
                        </button>
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Auswahlliste unter{' '}
                      <Link
                        href="/admin"
                        className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                      >
                        Admin → Metadaten
                      </Link>
                      . „Andere…“ nur bei Bedarf.
                    </p>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">Reichweite</label>
                    <select
                      value={(editForm.reach_scope as string) ?? 'intern'}
                      onChange={(e) => setEditForm((f) => ({ ...f, reach_scope: e.target.value as 'intern' | 'extern' }))}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                    >
                      <option value="intern">intern</option>
                      <option value="extern">extern</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">Beschlussgremium</label>
                    <input
                      type="text"
                      value={(editForm.gremium as string) ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, gremium: e.target.value || null }))}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                      placeholder="optional"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">Beteiligung</label>
                    <div className="mb-1 flex flex-wrap gap-1.5">
                      {PARTICIPATION_GROUP_OPTIONS.map((group) => {
                        const current = Array.isArray(editForm.participation_groups)
                          ? (editForm.participation_groups as string[])
                          : [];
                        const active = current.includes(group);
                        return (
                          <button
                            key={group}
                            type="button"
                            onClick={() =>
                              setEditForm((f) => {
                                const existing = Array.isArray(f.participation_groups)
                                  ? (f.participation_groups as string[])
                                  : [];
                                return {
                                  ...f,
                                  participation_groups: existing.includes(group)
                                    ? existing.filter((g) => g !== group)
                                    : [...existing, group],
                                };
                              })
                            }
                            className={`rounded border px-2 py-0.5 text-[11px] ${
                              active
                                ? 'border-blue-300 bg-blue-50 text-zinc-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50'
                                : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900'
                            }`}
                          >
                            {group}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editParticipationInput}
                        onChange={(e) => setEditParticipationInput(e.target.value)}
                        placeholder="Weitere Gruppe hinzufügen"
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const value = editParticipationInput.trim();
                          if (!value) return;
                          setEditForm((f) => {
                            const existing = Array.isArray(f.participation_groups)
                              ? (f.participation_groups as string[])
                              : [];
                            if (existing.includes(value)) return f;
                            return { ...f, participation_groups: [...existing, value].slice(0, 20) };
                          });
                          setEditParticipationInput('');
                        }}
                        className="rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                      >
                        Hinzufügen
                      </button>
                    </div>
                    {Array.isArray(editForm.participation_groups) && editForm.participation_groups.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(editForm.participation_groups as string[]).map((group) => (
                          <span
                            key={group}
                            className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                          >
                            {group}
                            <button
                              type="button"
                              onClick={() =>
                                setEditForm((f) => ({
                                  ...f,
                                  participation_groups: Array.isArray(f.participation_groups)
                                    ? (f.participation_groups as string[]).filter((g) => g !== group)
                                    : [],
                                }))
                              }
                              aria-label={`${group} entfernen`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">Schutzklasse</label>
                    <select
                      value={editForm.protection_class_id ?? 1}
                      onChange={(e) => setEditForm((f) => ({ ...f, protection_class_id: parseInt(e.target.value, 10) }))}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                    >
                      <option value={1}>1 – Öffentlich</option>
                      <option value={2}>2 – Verwaltung/Sekretariat + Schulleitung</option>
                      <option value={3}>3 – Nur Schulleitung</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">Evaluation/Wiedervorlage</label>
                    <input
                      type="date"
                      value={(editForm.review_date as string) ?? ''}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, review_date: e.target.value || null }))
                      }
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">
                      Rechtsbezug <span className="font-normal text-zinc-400">(wird mit „Speichern" übernommen)</span>
                    </label>
                    <textarea
                      value={(editForm.legal_reference as string) ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, legal_reference: e.target.value || null }))}
                      rows={5}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                      placeholder="z. B. Gesetze, Vorschriften, Beschlüsse – optional"
                    />
                  </div>
                </div>
              ) : (
                <dl className="space-y-1">
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Datum</dt>
                    <dd>
                      {version
                        ? new Date(version.created_at).toLocaleDateString('de-DE')
                        : new Date(doc.created_at).toLocaleDateString('de-DE')}
                    </dd>
                  </div>
                  {version && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-zinc-500">Version</dt>
                      <dd>{version.version_number}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Typ</dt>
                    <dd>{docTypeLabel(doc.document_type_code)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Status</dt>
                    <dd>{statusLabelDe(doc.status)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Schutzklasse</dt>
                    <dd>{doc.protection_class_id}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Evaluation/Wiedervorlage</dt>
                    <dd>
                      {doc.review_date ? new Date(`${doc.review_date}T00:00:00`).toLocaleDateString('de-DE') : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Reichweite</dt>
                    <dd>{doc.reach_scope ?? 'intern'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Verantwortlich</dt>
                    <dd>{doc.responsible_unit}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Beschlussgremium</dt>
                    <dd>{doc.gremium ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Beteiligung</dt>
                    <dd>{(doc.participation_groups ?? []).length ? (doc.participation_groups ?? []).join(', ') : '—'}</dd>
                  </div>
                  {doc.schulentwicklung_primary_field ? (
                    <div className="flex flex-col gap-0.5 border-t border-zinc-100 pt-1 dark:border-zinc-800">
                      <dt className="text-zinc-500">Schulentwicklung (KI)</dt>
                      <dd className="text-right text-[11px] text-zinc-800 dark:text-zinc-200">
                        <span className="font-medium">
                          Primär: {schulentwicklungFieldLabelDe(doc.schulentwicklung_primary_field)}
                        </span>
                        {doc.schulentwicklung_fields && doc.schulentwicklung_fields.length > 0 ? (
                          <span className="mt-0.5 block text-zinc-500 dark:text-zinc-400">
                            Felder:{' '}
                            {doc.schulentwicklung_fields.map((f) => schulentwicklungFieldLabelDe(f)).join(', ')}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-zinc-500">Rechtsbezug</dt>
                    <dd className="min-w-0 whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                      {doc.legal_reference?.trim()
                        ? (() => {
                            const lines = doc.legal_reference!.split('\n');
                            const show = lines.slice(0, 3).join('\n');
                            return lines.length > 3 ? `${show}\n[…]` : show;
                          })()
                        : '—'}
                    </dd>
                  </div>
                </dl>
              )}

              <div id="version-upload" className="mt-4 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
                <h3 className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  Neue Version hochladen
                </h3>
                <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Maximal {Math.round(maxVersionUploadBytes / 1024 / 1024)} MB pro Datei (PDF oder Word).
                </p>
                <form
                  ref={versionFormRef}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleVersionUpload();
                  }}
                >
                  <input
                    ref={versionInputRef}
                    type="file"
                    name="file"
                    accept=".pdf,.doc,.docx,.odt"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      versionFileRef.current = f;
                      setVersionFileName(f?.name ?? null);
                    }}
                    className="sr-only"
                    id="version-file-input"
                  />
                  <label
                    htmlFor="version-file-input"
                    className="mb-2 flex w-full cursor-pointer items-center justify-center rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Datei auswählen (.pdf, .doc, .docx, .odt)
                  </label>
                  {versionFileName && (
                    <p className="mb-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                      Ausgewählt: {versionFileName}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={versionLoading}
                    className="w-full rounded bg-zinc-200 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                  >
                    {versionLoading ? 'Wird hochgeladen…' : 'Version hochladen'}
                  </button>
                  {versionLoading && (
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400" aria-live="polite">
                      {LONG_RUNNING_EXPECTATION_HINT}
                    </p>
                  )}
                  {versionError && <p className="mt-1 text-[11px] text-red-500">{versionError}</p>}
                </form>
              </div>

              {auditLog.length > 0 && (
                <div className="mt-4 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                      Änderungsverlauf
                    </h3>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={auditImportantOnly}
                        onChange={(e) => setAuditImportantOnly(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-zinc-600"
                      />
                      Nur wichtige Änderungen (Status)
                    </label>
                  </div>

                  {auditBuckets.empty ? (
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      Keine passenden Einträge für den aktuellen Filter.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {auditBuckets.buckets
                        .filter((b) => b.items.length > 0)
                        .map((b) => (
                          <div key={b.label}>
                            <p className="mb-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                              {b.label}
                            </p>
                            <ul className="space-y-2">
                              {b.items.map((entry, i) => (
                                <li
                                  key={`${entry.created_at}-${i}`}
                                  className="rounded border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-800/50"
                                >
                                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                    {new Date(entry.created_at).toLocaleString('de-DE')}
                                  </p>
                                  <p className="mt-0.5 font-medium text-zinc-800 dark:text-zinc-200">
                                    {formatAuditSummary(entry)}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {doc && params?.id ? (
                <DocumentCommentsPanel
                  documentId={params.id}
                  userEmail={userEmail}
                  comments={comments}
                  onRefresh={reload}
                />
              ) : null}

              <div className="mt-4 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
                <h3 className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  Archiv & Löschen
                </h3>
                {doc.archived_at ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleRestoreFromVault()}
                      disabled={archiveLoading || deleteLoading}
                      className="mb-2 w-full rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                    >
                      {archiveLoading ? '…' : 'Aus Archiv wiederherstellen'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      disabled={archiveLoading || deleteLoading}
                      className="mb-2 w-full rounded border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      Endgültig löschen
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleArchiveToVault()}
                    disabled={archiveLoading || deleteLoading}
                    className="mb-2 w-full rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/40"
                  >
                    {archiveLoading ? '…' : 'Ins Archiv legen'}
                  </button>
                )}
                {deleteError && <ApiErrorCallout error={deleteError} className="text-xs" />}
              </div>
            </aside>
          </section>
        )}

        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <h2 id="delete-dialog-title" className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Dokument wirklich löschen?
              </h2>
              <p className="mb-4 text-xs text-zinc-600 dark:text-zinc-400">
                Das Dokument und alle Versionen werden entfernt. Gespeicherte KI-Anfragen, die darauf
                verweisen, werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteLoading}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteLoading ? '…' : 'Ja, endgültig löschen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
