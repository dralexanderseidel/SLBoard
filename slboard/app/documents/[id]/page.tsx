'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

type DocumentDetail = {
  id: string;
  title: string;
  document_type_code: string;
  created_at: string;
  status: string;
  protection_class_id: number;
  gremium: string | null;
  responsible_unit: string;
  legal_reference: string | null;
  summary: string | null;
};

type VersionInfo = {
  id: string;
  version_number: string;
  created_at: string;
  file_uri: string;
  mime_type: string;
};

const DOC_TYPES = ['ELTERNBRIEF', 'KONZEPT', 'PROTOKOLL', 'RUNDSCHREIBEN'];
const ORG_UNITS = ['Schulleitung', 'Sekretariat', 'Fachschaft Deutsch', 'Fachschaft Mathematik', 'Fachschaft Englisch', 'Steuergruppe', 'Lehrkräfte'];

/** Workflow: erlaubte nächste Schritte */
const WORKFLOW_NEXT: Record<string, { label: string; value: string } | null> = {
  ENTWURF: { label: 'Freigeben', value: 'FREIGEGEBEN' },
  FREIGEGEBEN: { label: 'Veröffentlichen', value: 'VEROEFFENTLICHT' },
  VEROEFFENTLICHT: null,
};

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<DocumentDetail>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const versionFormRef = useRef<HTMLFormElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);
  const versionFileRef = useRef<File | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [versionFileName, setVersionFileName] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [allVersions, setAllVersions] = useState<Array<{ id: string; version_number: string; created_at: string; comment: string | null; mime_type: string | null; is_current: boolean }>>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<Array<{ user_email: string; action: string; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string }>>([]);

  useEffect(() => {
    const load = async () => {
      if (!params?.id) return;

      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('documents')
        .select(
          'id, title, document_type_code, created_at, status, protection_class_id, gremium, responsible_unit, legal_reference, summary, current_version_id',
        )
        .eq('id', params.id)
        .single();

      if (error) {
        setError(error.message);
        setDoc(null);
      } else {
        const typed = data as DocumentDetail & { current_version_id?: string | null };
        setDoc(typed);
        setSummary(typed?.summary?.trim() ?? null);

        if (typed.current_version_id) {
          const { data: verData, error: verError } = await supabase
            .from('document_versions')
            .select('id, version_number, created_at, file_uri, mime_type')
            .eq('id', typed.current_version_id)
            .single();

          if (!verError && verData) {
            const v = verData as VersionInfo;
            setVersion(v);

            // Signed URL über API (Bucket ist privat)
            try {
              const res = await fetch(`/api/documents/${params.id}/file`);
              const data = (await res.json()) as { signedUrl?: string; error?: string };
              if (res.ok && data.signedUrl) {
                setPreviewUrl(data.signedUrl);
              }
            } catch {
              // Vorschau nicht verfügbar
            }
          }
        }

        // Versionen-Historie laden
        try {
          const verRes = await fetch(`/api/documents/${params.id}/versions`);
          const verJson = (await verRes.json()) as { data?: Array<{ id: string; version_number: string; created_at: string; comment: string | null; mime_type: string | null; is_current: boolean }> };
          if (verRes.ok && verJson.data) setAllVersions(verJson.data);
        } catch {
          setAllVersions([]);
        }
        setSelectedVersionId(typed.current_version_id ?? null);

        try {
          const auditRes = await fetch(`/api/documents/${params.id}/audit`);
          const auditJson = (await auditRes.json()) as { data?: typeof auditLog };
          if (auditRes.ok && auditJson.data) setAuditLog(auditJson.data);
        } catch {
          setAuditLog([]);
        }
      }

      setLoading(false);
    };

    void load();
  }, [params?.id, reloadKey]);

  // Bei Wechsel der ausgewählten Version: Datei-URL laden
  useEffect(() => {
    if (!params?.id || !selectedVersionId) return;
    const chosen = allVersions.find((v) => v.id === selectedVersionId);
    if (!chosen) return;

    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/documents/${params.id}/file?versionId=${encodeURIComponent(selectedVersionId)}`);
      const data = (await res.json()) as { signedUrl?: string; error?: string };
      if (cancelled) return;
      if (res.ok && data.signedUrl) {
        setPreviewUrl(data.signedUrl);
        setVersion({
          id: chosen.id,
          version_number: chosen.version_number,
          created_at: chosen.created_at,
          file_uri: '',
          mime_type: chosen.mime_type ?? 'application/pdf',
        });
      } else {
        setPreviewUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [params?.id, selectedVersionId, allVersions]);

  const handleWorkflowStep = async (newStatus: string) => {
    if (!params?.id) return;
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
      setReloadKey((k) => k + 1);
    } catch (e) {
      setWorkflowError(e instanceof Error ? e.message : 'Fehler beim Status-Wechsel.');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleEdit = () => {
    if (doc) {
      setEditForm({
        title: doc.title,
        legal_reference: doc.legal_reference ?? '',
        gremium: doc.gremium ?? '',
        responsible_unit: doc.responsible_unit,
        document_type_code: doc.document_type_code,
        protection_class_id: doc.protection_class_id,
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
      setReloadKey((k) => k + 1);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Hochladen.');
      versionFileRef.current = null;
      setVersionFileName(null);
      setSummary(null);
      setDoc((prev) => (prev ? { ...prev, summary: null } : null));
      versionFormRef.current?.reset();
      if (versionInputRef.current) versionInputRef.current.value = '';
      setReloadKey((k) => k + 1);
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

  const handleSummarize = async () => {
    if (!doc) return;
    setSummaryLoading(true);
    setSummaryError(null);

    const payload = {
      documentId: params?.id,
      title: doc.title,
      type: doc.document_type_code,
      createdAt: new Date(doc.created_at).toLocaleDateString('de-DE'),
      text:
        doc.legal_reference ??
        `Dieses Dokument ist ein ${doc.document_type_code} der Organisationseinheit ${doc.responsible_unit}${
          doc.gremium ? ` im Gremium ${doc.gremium}` : ''
        }.`,
    };

    const run = async (attempt: number) => {
      try {
        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          // Rate-Limit-Handling mit einem automatischen Retry
          const isRateLimited =
            res.status === 429 ||
            (typeof data?.details?.error?.code === 'number' && data.details.error.code === 429) ||
            (typeof data?.details?.error?.metadata?.raw === 'string' &&
              data.details.error.metadata.raw.toLowerCase().includes('rate-limited'));

          if (isRateLimited && attempt === 1) {
            setSummaryError(
              'Das verwendete kostenlose KI-Modell ist aktuell ausgelastet. Es wird automatisch ein zweiter Versuch gestartet …',
            );
            // kurzer Backoff, dann zweiter Versuch
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await run(2);
            return;
          }

          const msgBase =
            data.error ||
            'Fehler bei der KI-Zusammenfassung. Bitte versuchen Sie es später erneut.';

          const detailsText =
            typeof data.details === 'string'
              ? data.details
              : data.details
              ? JSON.stringify(data.details)
              : '';

          const msg = detailsText ? `${msgBase}: ${detailsText}` : msgBase;
          setSummaryError(msg);
        } else {
          setSummary(data.summary);
          setSummaryError(null);
        }
      } catch (e: any) {
        setSummaryError(e?.message ?? 'Fehler bei der KI-Zusammenfassung.');
      } finally {
        setSummaryLoading(false);
      }
    };

    await run(1);
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-semibold">
              {doc ? doc.title : 'Dokumentansicht'}
            </h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Detailansicht eines schulischen Dokuments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
            >
              ← Zur Übersicht
            </button>
            <Link
              href="/"
              className="text-xs text-zinc-500 underline-offset-2 hover:underline"
            >
              Startseite
            </Link>
          </div>
        </header>

        {loading && <p className="text-sm text-zinc-600 dark:text-zinc-400">Lade Dokument…</p>}
        {error && (
          <p className="text-sm text-red-600">
            Fehler beim Laden des Dokuments: {error}
          </p>
        )}
        {!loading && !error && !doc && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Dokument wurde nicht gefunden.
          </p>
        )}

        {doc && (
          <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {/* Linke Spalte: Inhalt / Vorschau */}
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {doc.document_type_code === 'PROTOKOLL'
                  ? 'Protokoll'
                  : doc.document_type_code === 'ELTERNBRIEF'
                  ? 'Elternbrief'
                  : 'Dokument'}
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

              {!previewUrl && doc.legal_reference && doc.legal_reference.length > 50 && (
                <div className="mb-3 max-h-80 overflow-y-auto rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                  <h3 className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    Entwurfstext
                  </h3>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                    {doc.legal_reference}
                  </pre>
                </div>
              )}

              {!previewUrl && (!doc.legal_reference || doc.legal_reference.length <= 50) && (
                <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Für dieses Dokument steht noch keine Vorschau zur Verfügung.
                </p>
              )}

              {version && previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 inline-flex items-center text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                >
                  Dokument in neuem Tab öffnen
                </a>
              )}

              <div className="mt-3 rounded border border-dashed border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                <p className="mb-1 font-medium">Kurzbeschreibung</p>
                <p>
                  Dieses Dokument ist ein {doc.document_type_code.toLowerCase()} der
                  Organisationseinheit{' '}
                  <span className="font-medium">{doc.responsible_unit}</span>
                  {doc.gremium && (
                    <>
                      {' '}
                      im Gremium <span className="font-medium">{doc.gremium}</span>
                    </>
                  )}
                  . Erstelldatum:{' '}
                  <span className="font-medium">
                    {new Date(doc.created_at).toLocaleDateString('de-DE')}
                  </span>
                  .
                </p>
              </div>

              <div className="mt-3 rounded border border-zinc-200 bg-white p-3 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
                <h3 className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  KI-Kurz­zusammenfassung
                </h3>
                <button
                  type="button"
                  onClick={handleSummarize}
                  disabled={summaryLoading}
                  className="mb-2 inline-flex items-center justify-center rounded bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {summaryLoading ? 'KI fasst zusammen…' : 'Zusammenfassung erzeugen'}
                </button>
                {summaryError && <p className="text-[11px] text-red-500">{summaryError}</p>}
                {summary && !summaryError && (
                  <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
                    {summary}
                  </p>
                )}
                {!summary && !summaryLoading && !summaryError && (
                  <p className="text-zinc-600 dark:text-zinc-300">
                    Noch keine Zusammenfassung vorhanden. Klicken Sie auf „Zusammenfassung
                    erzeugen“, um eine KI-basierte Kurzfassung zu erhalten.
                  </p>
                )}
              </div>

              <Link
                href={`/drafts?sourceId=${doc.id}&subject=${encodeURIComponent(doc.title)}`}
                className="mt-3 inline-flex items-center justify-center rounded border border-dashed border-zinc-400 px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Entwurf erstellen
              </Link>
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
              {saveError && <p className="mb-2 text-[11px] text-red-500">{saveError}</p>}
              {/* Status & Workflow: nur erlaubte Schritte Entwurf → Freigegeben → Veröffentlicht */}
              {doc && (
                <div className="mb-3 rounded border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-zinc-500">Status</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">
                      {doc.status === 'ENTWURF' && 'Entwurf'}
                      {doc.status === 'FREIGEGEBEN' && 'Freigegeben'}
                      {doc.status === 'VEROEFFENTLICHT' && 'Veröffentlicht'}
                    </span>
                  </div>
                  {WORKFLOW_NEXT[doc.status] && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleWorkflowStep(WORKFLOW_NEXT[doc.status]!.value)}
                        disabled={workflowLoading}
                        className="w-full rounded bg-blue-600 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {workflowLoading ? '…' : WORKFLOW_NEXT[doc.status]!.label}
                      </button>
                      {workflowError && (
                        <p className="mt-1 text-[11px] text-red-500">{workflowError}</p>
                      )}
                    </>
                  )}
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
                      <option value="ELTERNBRIEF">Elternbrief</option>
                      <option value="KONZEPT">Konzept</option>
                      <option value="PROTOKOLL">Protokoll</option>
                      <option value="RUNDSCHREIBEN">Rundschreiben</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">Organisationseinheit</label>
                    <select
                      value={editForm.responsible_unit ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, responsible_unit: e.target.value }))}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                    >
                      <option value="Schulleitung">Schulleitung</option>
                      <option value="Sekretariat">Sekretariat</option>
                      <option value="Fachschaft Deutsch">Fachschaft Deutsch</option>
                      <option value="Fachschaft Mathematik">Fachschaft Mathematik</option>
                      <option value="Fachschaft Englisch">Fachschaft Englisch</option>
                      <option value="Steuergruppe">Steuergruppe</option>
                      <option value="Lehrkräfte">Lehrkräfte</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">Gremium</label>
                    <input
                      type="text"
                      value={(editForm.gremium as string) ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, gremium: e.target.value || null }))}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                      placeholder="optional"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">Schutzklasse</label>
                    <select
                      value={editForm.protection_class_id ?? 1}
                      onChange={(e) => setEditForm((f) => ({ ...f, protection_class_id: parseInt(e.target.value, 10) }))}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                    >
                      <option value={1}>1 – Öffentlich</option>
                      <option value={2}>2 – Intern</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-zinc-500">
                      Rechtsbezug <span className="font-normal text-zinc-400">(wird mit „Speichern“ übernommen)</span>
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
                    <dd>{doc.document_type_code}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Status</dt>
                    <dd>
                      {doc.status === 'ENTWURF' && 'Entwurf'}
                      {doc.status === 'FREIGEGEBEN' && 'Freigegeben'}
                      {doc.status === 'VEROEFFENTLICHT' && 'Veröffentlicht'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Schutzklasse</dt>
                    <dd>{doc.protection_class_id}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Organisationseinheit</dt>
                    <dd>{doc.responsible_unit}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-zinc-500">Gremium</dt>
                    <dd>{doc.gremium ?? '—'}</dd>
                  </div>
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

              <div className="mt-4 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
                <h3 className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  Neue Version hochladen
                </h3>
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
                  {versionError && <p className="mt-1 text-[11px] text-red-500">{versionError}</p>}
                </form>
              </div>

              {auditLog.length > 0 && (
                <div className="mt-4 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
                  <h3 className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                    Änderungsverlauf
                  </h3>
                  <ul className="space-y-2">
                    {auditLog.map((entry, i) => (
                      <li key={i} className="rounded border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                          {new Date(entry.created_at).toLocaleString('de-DE')}
                          {' · '}
                          {entry.user_email}
                        </p>
                        <p className="mt-0.5 font-medium text-zinc-800 dark:text-zinc-200">
                          {entry.action === 'document.update' && 'Metadaten/Status geändert'}
                          {entry.action === 'version.upload' && (entry.new_values as { version_number?: string })?.version_number
                            ? `Version ${(entry.new_values as { version_number: string }).version_number} hochgeladen`
                            : 'Neue Version hochgeladen'}
                        </p>
                        {entry.action === 'document.update' && entry.new_values && Object.keys(entry.new_values).length > 0 && (
                          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                            Geändert: {Object.keys(entry.new_values).join(', ')}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
                <h3 className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  Dokument löschen
                </h3>
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="mb-2 w-full rounded border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
                >
                  Löschen
                </button>
                {deleteError && <p className="text-[11px] text-red-500">{deleteError}</p>}
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
                Diese Aktion kann nicht rückgängig gemacht werden. Das Dokument und alle Versionen werden dauerhaft gelöscht.
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

