'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type AppUser = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  org_unit: string;
  school_number: string | null;
  created_at: string;
  roles: string[];
};

const AVAILABLE_ROLES = [
  'SCHULLEITUNG',
  'SEKRETARIAT',
  'VERWALTUNG',
  'KOORDINATION',
  'LEHRKRAFT',
  'FACHVORSITZ',
  'STEUERGRUPPE',
];

const ORG_UNITS = [
  'Schulleitung',
  'Sekretariat',
  'Fachschaft Deutsch',
  'Fachschaft Mathematik',
  'Fachschaft Englisch',
  'Steuergruppe',
  'Lehrkräfte',
];

type DocumentTypeOption = { code: string; label: string; active: boolean; sort_order: number };
type ResponsibleUnitOption = { name: string; active: boolean; sort_order: number };
type PromptUseCase = 'qa' | 'summary' | 'steering';
type PromptTemplateConfig = {
  use_case: PromptUseCase;
  system_locked: string;
  user_locked: string;
  system_editable: string;
  user_editable: string;
  version: number;
  updated_at: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [usersPanelOpen, setUsersPanelOpen] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [promptPanelOpen, setPromptPanelOpen] = useState(true);
  const [metadataPanelOpen, setMetadataPanelOpen] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reindexLoading, setReindexLoading] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiForm, setAiForm] = useState({
    max_text_per_doc: 4500,
    chunk_chars: 2500,
    chunk_overlap_chars: 300,
    max_chunks_per_doc: 3,
    llm_timeout_ms: 45000,
    debug_log_enabled: false,
    school_profile_text: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppUser>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    full_name: '',
    email: '',
    org_unit: 'Schulleitung',
    school_number: '',
  });
  const [saving, setSaving] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaMessage, setMetaMessage] = useState<string | null>(null);
  const [docTypeOptions, setDocTypeOptions] = useState<DocumentTypeOption[]>([]);
  const [responsibleUnitOptions, setResponsibleUnitOptions] = useState<ResponsibleUnitOption[]>([]);
  const [newRespUnit, setNewRespUnit] = useState('');
  const [newDocTypeCode, setNewDocTypeCode] = useState('');
  const [newDocTypeLabel, setNewDocTypeLabel] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptMessage, setPromptMessage] = useState<string | null>(null);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplateConfig[]>([]);
  const [activePromptUseCase, setActivePromptUseCase] = useState<PromptUseCase>('steering');
  const [promptPreviewLoading, setPromptPreviewLoading] = useState(false);
  const [promptPreviewResult, setPromptPreviewResult] = useState<string | null>(null);

  const activeOrgUnitOptions = (responsibleUnitOptions.length > 0
    ? responsibleUnitOptions.filter((u) => u.active).map((u) => u.name).filter(Boolean)
    : ORG_UNITS
  );
  const orgUnitSelectOptions = (current?: string) => {
    const cur = (current ?? '').trim();
    if (!cur) return activeOrgUnitOptions;
    return activeOrgUnitOptions.includes(cur) ? activeOrgUnitOptions : [cur, ...activeOrgUnitOptions];
  };

  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    const usersParam = p.get('usersPanel');
    const aiParam = p.get('aiPanel');
    const promptParam = p.get('promptPanel');
    const metaParam = p.get('metaPanel');
    if (usersParam === '0' || usersParam === '1') setUsersPanelOpen(usersParam === '1');
    if (aiParam === '0' || aiParam === '1') setAiPanelOpen(aiParam === '1');
    if (promptParam === '0' || promptParam === '1') setPromptPanelOpen(promptParam === '1');
    if (metaParam === '0' || metaParam === '1') setMetadataPanelOpen(metaParam === '1');
  }, [searchParams]);

  const setPanelQuery = (next: { users?: boolean; ai?: boolean; prompt?: boolean; meta?: boolean }) => {
    const p = new URLSearchParams(searchParams.toString());
    if (typeof next.users === 'boolean') p.set('usersPanel', next.users ? '1' : '0');
    if (typeof next.ai === 'boolean') p.set('aiPanel', next.ai ? '1' : '0');
    if (typeof next.prompt === 'boolean') p.set('promptPanel', next.prompt ? '1' : '0');
    if (typeof next.meta === 'boolean') p.set('metaPanel', next.meta ? '1' : '0');
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? 'Fehler beim Laden.';
        if (res.status === 401 && msg.includes('Anmeldung')) {
          throw new Error(
            `${msg} Falls Sie bereits angemeldet sind: Bitte melden Sie sich ab und erneut an, damit die Sitzung funktioniert.`
          );
        }
        throw new Error(msg);
      }
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden der Nutzer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    const load = async () => {
      setPromptLoading(true);
      setPromptError(null);
      setPromptMessage(null);
      try {
        const res = await fetch('/api/admin/ai-prompts', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'KI-Prompts konnten nicht geladen werden.');
        setPromptTemplates((data.templates ?? []) as PromptTemplateConfig[]);
      } catch (e) {
        setPromptError(e instanceof Error ? e.message : 'KI-Prompts konnten nicht geladen werden.');
      } finally {
        setPromptLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const load = async () => {
      setMetaLoading(true);
      setMetaError(null);
      setMetaMessage(null);
      try {
        const res = await fetch('/api/admin/metadata', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Metadaten konnten nicht geladen werden.');
        setDocTypeOptions((data.documentTypes ?? []) as DocumentTypeOption[]);
        setResponsibleUnitOptions((data.responsibleUnits ?? []) as ResponsibleUnitOption[]);
      } catch (e) {
        setMetaError(e instanceof Error ? e.message : 'Metadaten konnten nicht geladen werden.');
      } finally {
        setMetaLoading(false);
      }
    };
    void load();
  }, []);

  const handleSaveMetadata = async () => {
    setMetaLoading(true);
    setMetaError(null);
    setMetaMessage(null);
    try {
      const res = await fetch('/api/admin/metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTypes: docTypeOptions,
          responsibleUnits: responsibleUnitOptions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Metadaten konnten nicht gespeichert werden.');
      setMetaMessage('Metadaten gespeichert.');
    } catch (e) {
      setMetaError(e instanceof Error ? e.message : 'Metadaten konnten nicht gespeichert werden.');
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setAiLoading(true);
      setAiError(null);
      try {
        const res = await fetch('/api/admin/ai-settings', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'KI-Einstellungen konnten nicht geladen werden.');
        const s = data.settings ?? {};
        setAiForm({
          max_text_per_doc: Number(s.max_text_per_doc) || 4500,
          chunk_chars: Number(s.chunk_chars) || 2500,
          chunk_overlap_chars: Number(s.chunk_overlap_chars) || 300,
          max_chunks_per_doc: Number(s.max_chunks_per_doc) || 3,
          llm_timeout_ms: Number(s.llm_timeout_ms) || 45000,
          debug_log_enabled: Boolean(s.debug_log_enabled),
          school_profile_text: (data.school_profile_text as string | undefined) ?? '',
        });
      } catch (e) {
        setAiError(e instanceof Error ? e.message : 'KI-Einstellungen konnten nicht geladen werden.');
      } finally {
        setAiLoading(false);
      }
    };
    void load();
  }, []);

  const handleSaveAiSettings = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiMessage(null);
    try {
      const res = await fetch('/api/admin/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'KI-Einstellungen konnten nicht gespeichert werden.');
      setAiMessage('KI-Konfiguration gespeichert.');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'KI-Einstellungen konnten nicht gespeichert werden.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSavePromptTemplates = async () => {
    setPromptLoading(true);
    setPromptError(null);
    setPromptMessage(null);
    try {
      const payload = {
        templates: promptTemplates.map((t) => ({
          use_case: t.use_case,
          system_editable: t.system_editable,
          user_editable: t.user_editable,
        })),
      };
      const res = await fetch('/api/admin/ai-prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'KI-Prompts konnten nicht gespeichert werden.');
      setPromptTemplates((data.templates ?? []) as PromptTemplateConfig[]);
      setPromptMessage('KI-Prompts gespeichert.');
    } catch (e) {
      setPromptError(e instanceof Error ? e.message : 'KI-Prompts konnten nicht gespeichert werden.');
    } finally {
      setPromptLoading(false);
    }
  };

  const handlePreviewPrompt = async (mode: 'prompt_only' | 'llm_test') => {
    setPromptPreviewLoading(true);
    setPromptError(null);
    setPromptMessage(null);
    setPromptPreviewResult(null);
    try {
      const res = await fetch('/api/admin/ai-prompts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_case: activePromptUseCase, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Prompt-Preview fehlgeschlagen.');
      const showSteeringFormat =
        activePromptUseCase === 'steering' && (data.mode ?? mode) === 'llm_test';
      const formatInfo = showSteeringFormat
        ? ` · JSON-Format ok: ${data.steeringFormatOk ? 'ja' : 'nein'}`
        : '';
      const errorInfo =
        showSteeringFormat && Array.isArray(data.steeringFormatErrors) && data.steeringFormatErrors.length > 0
          ? `\nFehler:\n- ${(data.steeringFormatErrors as string[]).join('\n- ')}`
          : '';
      setPromptPreviewResult(
        `Use Case: ${data.use_case} · Modus: ${data.mode ?? mode}${formatInfo}${errorInfo}\n\n` +
          `--- Prompt-Ausgabe (gekürzt) ---\n${(data.outputPreview as string | undefined) ?? 'Keine Ausgabe (nur Vorschau).'}` 
      );
    } catch (e) {
      setPromptError(e instanceof Error ? e.message : 'Prompt-Preview fehlgeschlagen.');
    } finally {
      setPromptPreviewLoading(false);
    }
  };

  const handleResetPromptTemplate = async () => {
    const ok = window.confirm(`Prompt-Bausteine fuer "${activePromptUseCase}" auf Schul-Default zuruecksetzen?`);
    if (!ok) return;
    setPromptLoading(true);
    setPromptError(null);
    setPromptMessage(null);
    try {
      const res = await fetch('/api/admin/ai-prompts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_case: activePromptUseCase }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Reset fehlgeschlagen.');
      setPromptTemplates((data.templates ?? []) as PromptTemplateConfig[]);
      setPromptMessage(`Prompt-Bausteine fuer "${activePromptUseCase}" auf Default zurueckgesetzt.`);
    } catch (e) {
      setPromptError(e instanceof Error ? e.message : 'Reset fehlgeschlagen.');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleReindexDocuments = async () => {
    const ok = window.confirm(
      'Dokumente neu indizieren?\n\nDies extrahiert Text aus Dateien und setzt search_text/keywords.\nJe nach Anzahl und Dateigröße kann das etwas dauern.'
    );
    if (!ok) return;
    setReindexLoading(true);
    setReindexProgress('Starte…');
    setError(null);
    setMessage(null);
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
      setMessage(`Reindex abgeschlossen. OK: ${totalOk}, Fehler: ${totalFailed}.`);
      setReindexProgress(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reindex fehlgeschlagen.');
    } finally {
      setReindexLoading(false);
    }
  };

  const handleEdit = (u: AppUser) => {
    setEditingId(u.id);
    setEditForm({
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      org_unit: u.org_unit,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Speichern.');
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingId ? { ...u, ...editForm } : u
        )
      );
      setEditingId(null);
      setMessage('Nutzer aktualisiert.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const handleRolesChange = async (userId: string, newRoles: string[]) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: newRoles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Speichern der Rollen.');
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, roles: newRoles } : u))
      );
      setMessage('Rollen aktualisiert.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.username.trim() || !createForm.full_name.trim() || !createForm.email.trim()) {
      setError('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          org_unit: createForm.org_unit,
          school_number: createForm.school_number,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Anlegen.');
      setUsers((prev) => [...prev, data.user]);
      setCreateForm({ username: '', full_name: '', email: '', org_unit: 'Schulleitung', school_number: '' });
      setShowCreate(false);
      setMessage('Nutzer angelegt.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Anlegen.');
    } finally {
      setSaving(false);
    }
  };

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
            <button
              type="button"
              onClick={() => void handleReindexDocuments()}
              disabled={reindexLoading}
              className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50 dark:hover:bg-blue-950"
              title="search_text/keywords für bestehende Dokumente neu erzeugen"
            >
              {reindexLoading ? 'Reindex läuft…' : 'Dokumente reindizieren'}
            </button>
            <Link
              href="/"
              className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
            >
              ← Zurück
            </Link>
          </div>
        </header>

        {reindexProgress && (
          <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
            {reindexProgress}
          </p>
        )}

        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
            {message}
          </p>
        )}

        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => {
              const next = !usersPanelOpen;
              setUsersPanelOpen(next);
              setPanelQuery({ users: next });
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Nutzer & Rollen</h2>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Benutzerverwaltung inkl. Rollen und Organisationseinheiten.
              </p>
            </div>
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              aria-hidden="true"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-transform ${usersPanelOpen ? 'rotate-180' : ''}`}
              >
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

          {usersPanelOpen && (
            <div className="space-y-4 border-t border-zinc-200 p-4 dark:border-zinc-800">
              <div>
                <button
                  type="button"
                  onClick={() => setShowCreate(!showCreate)}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  {showCreate ? 'Neues Nutzerformular schließen' : 'Neuen Nutzer anlegen'}
                </button>
              </div>
              {showCreate && (
                <form
                  onSubmit={handleCreate}
                  className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <h2 className="mb-3 text-sm font-semibold">Neuen Nutzer anlegen</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Benutzername *
                      </label>
                      <input
                        type="text"
                        value={createForm.username}
                        onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                        className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        placeholder="z.B. mueller"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Vollständiger Name *
                      </label>
                      <input
                        type="text"
                        value={createForm.full_name}
                        onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                        className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        placeholder="z.B. Dr. Anna Müller"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        E-Mail *
                      </label>
                      <input
                        type="email"
                        value={createForm.email}
                        onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        placeholder="leitung@schule.de"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Schulnummer (6-stellig)
                      </label>
                      <input
                        type="text"
                        value={createForm.school_number}
                        onChange={(e) => setCreateForm((f) => ({ ...f, school_number: e.target.value }))}
                        className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        placeholder="z.B. 123456"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Organisationseinheit
                      </label>
                      <select
                        value={createForm.org_unit}
                        onChange={(e) => setCreateForm((f) => ({ ...f, org_unit: e.target.value }))}
                        className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        {orgUnitSelectOptions(createForm.org_unit).map((ou) => (
                          <option key={ou} value={ou}>
                            {ou}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? 'Wird angelegt…' : 'Nutzer anlegen'}
                  </button>
                </form>
              )}

              {loading ? (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="p-3">
                    <div className="mb-3 h-4 w-36 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="space-y-2">
                      <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                      <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                      <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                      <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                      <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Lade Nutzer…</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="p-3 font-semibold text-zinc-800 dark:text-zinc-100">
                          Benutzer
                        </th>
                        <th className="p-3 font-semibold text-zinc-800 dark:text-zinc-100">E-Mail</th>
                        <th className="p-3 font-semibold text-zinc-800 dark:text-zinc-100">Schulnummer</th>
                        <th className="p-3 font-semibold text-zinc-800 dark:text-zinc-100">Org.-Einheit</th>
                        <th className="p-3 font-semibold text-zinc-800 dark:text-zinc-100">Rollen</th>
                        <th className="p-3 font-semibold text-zinc-800 dark:text-zinc-100">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr
                          key={u.id}
                          className="border-b border-zinc-100 dark:border-zinc-800"
                        >
                          <td className="p-3">
                            {editingId === u.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editForm.username ?? ''}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, username: e.target.value }))
                                  }
                                  className="w-full rounded border px-2 py-1 text-xs"
                                  placeholder="Benutzername"
                                />
                                <input
                                  type="text"
                                  value={editForm.full_name ?? ''}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, full_name: e.target.value }))
                                  }
                                  className="w-full rounded border px-2 py-1 text-xs"
                                  placeholder="Vollständiger Name"
                                />
                              </div>
                            ) : (
                              <div>
                                <div className="font-medium">{u.full_name}</div>
                                <div className="text-[11px] text-zinc-500">{u.username}</div>
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            {editingId === u.id ? (
                              <input
                                type="email"
                                value={editForm.email ?? ''}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, email: e.target.value }))
                                }
                                className="w-full rounded border px-2 py-1 text-xs"
                              />
                            ) : (
                              <span className="text-zinc-700 dark:text-zinc-300">{u.email}</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="text-zinc-700 dark:text-zinc-300">{u.school_number ?? '—'}</span>
                          </td>
                          <td className="p-3">
                            {editingId === u.id ? (
                              <select
                                value={editForm.org_unit ?? ''}
                                onChange={(e) =>
                                  setEditForm((f) => ({ ...f, org_unit: e.target.value }))
                                }
                                className="rounded border px-2 py-1 text-xs"
                              >
                                {orgUnitSelectOptions(editForm.org_unit as string | undefined).map((ou) => (
                                  <option key={ou} value={ou}>
                                    {ou}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>{u.org_unit}</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-2">
                              {AVAILABLE_ROLES.map((role) => {
                                const checked = u.roles.includes(role);
                                return (
                                  <label
                                    key={role}
                                    className="flex items-center gap-1 text-[11px]"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const newRoles = e.target.checked
                                          ? [...u.roles, role]
                                          : u.roles.filter((r) => r !== role);
                                        void handleRolesChange(u.id, newRoles);
                                      }}
                                      disabled={saving}
                                      className="rounded"
                                    />
                                    {role}
                                  </label>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-3">
                            {editingId === u.id ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleSaveEdit}
                                  disabled={saving}
                                  className="rounded bg-blue-600 px-2 py-1 text-[11px] text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                  Speichern
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                                >
                                  Abbrechen
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleEdit(u)}
                                className="rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                              >
                                Bearbeiten
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Hinweis: Diese Oberfläche verwaltet die Tabelle app_users. Nutzer für Supabase Auth
                (Login) müssen separat im Supabase-Dashboard unter Authentication → Users angelegt werden.
                Die E-Mail sollte mit app_users übereinstimmen.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => {
              const next = !aiPanelOpen;
              setAiPanelOpen(next);
              setPanelQuery({ ai: next });
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">KI-Konfiguration</h2>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Einstellungen für Chunking, Timeout, Schulkontext und Debug-Logging.
              </p>
            </div>
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              aria-hidden="true"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-transform ${aiPanelOpen ? 'rotate-180' : ''}`}
              >
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          {aiPanelOpen && (
            <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">

          {aiError && (
            <p className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {aiError}
            </p>
          )}
          {aiMessage && (
            <p className="mb-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
              {aiMessage}
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                Max. Zeichen pro Dokument im Prompt
              </label>
              <input
                type="number"
                value={aiForm.max_text_per_doc}
                onChange={(e) => setAiForm((p) => ({ ...p, max_text_per_doc: Number(e.target.value) }))}
                className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                Chunk-Größe (Zeichen)
              </label>
              <input
                type="number"
                value={aiForm.chunk_chars}
                onChange={(e) => setAiForm((p) => ({ ...p, chunk_chars: Number(e.target.value) }))}
                className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                Chunk-Overlap (Zeichen)
              </label>
              <input
                type="number"
                value={aiForm.chunk_overlap_chars}
                onChange={(e) => setAiForm((p) => ({ ...p, chunk_overlap_chars: Number(e.target.value) }))}
                className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                Max. Chunks pro Dokument
              </label>
              <input
                type="number"
                value={aiForm.max_chunks_per_doc}
                onChange={(e) => setAiForm((p) => ({ ...p, max_chunks_per_doc: Number(e.target.value) }))}
                className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                LLM-Timeout (ms)
              </label>
              <input
                type="number"
                value={aiForm.llm_timeout_ms}
                onChange={(e) => setAiForm((p) => ({ ...p, llm_timeout_ms: Number(e.target.value) }))}
                className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1">
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              Schul-Steckbrief (für KI-Kontext)
            </label>
            <textarea
              value={aiForm.school_profile_text}
              onChange={(e) => setAiForm((p) => ({ ...p, school_profile_text: e.target.value }))}
              rows={4}
              placeholder="z. B. Schule mit 80 Lehrkräften, gebundener Ganztag, hoher Förderbedarf im Sek-I-Bereich."
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Wird optional in KI-Prompts als zusätzlicher Schulkontext verwendet.
            </p>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={aiForm.debug_log_enabled}
              onChange={(e) => setAiForm((p) => ({ ...p, debug_log_enabled: e.target.checked }))}
              className="rounded"
            />
            Debug-Logging aktivieren (Chunks + Prompts)
          </label>

              <button
                type="button"
                onClick={handleSaveAiSettings}
                disabled={aiLoading}
                className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {aiLoading ? 'Speichere…' : 'KI-Konfiguration speichern'}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => {
              const next = !promptPanelOpen;
              setPromptPanelOpen(next);
              setPanelQuery({ prompt: next });
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">KI-Prompts</h2>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Schulspezifische Prompt-Bausteine mit gesperrtem Antwortformat.
              </p>
            </div>
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              aria-hidden="true"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-transform ${promptPanelOpen ? 'rotate-180' : ''}`}
              >
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          {promptPanelOpen && (
            <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Bearbeitbar sind nur die Zusatzbausteine. Das Antwortformat (z. B. JSON fuer Steuerungsanalyse)
                bleibt im gesperrten Block unveraendert.
              </p>

              {promptError && (
                <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                  {promptError}
                </p>
              )}
              {promptMessage && (
                <p className="mt-2 rounded border border-green-200 bg-green-50 px-2 py-1 text-[11px] text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                  {promptMessage}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {(['qa', 'summary', 'steering'] as PromptUseCase[]).map((uc) => (
                  <button
                    key={uc}
                    type="button"
                    onClick={() => setActivePromptUseCase(uc)}
                    className={`rounded border px-2 py-1 text-[11px] ${
                      activePromptUseCase === uc
                        ? 'border-blue-300 bg-blue-50 text-zinc-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-zinc-50'
                        : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'
                    }`}
                  >
                    {uc === 'qa' ? 'Q&A' : uc === 'summary' ? 'Zusammenfassung' : 'Steuerungsanalyse'}
                  </button>
                ))}
              </div>

              {promptLoading && promptTemplates.length === 0 ? (
                <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">Lade Prompt-Templates…</p>
              ) : (
                (() => {
                  const current = promptTemplates.find((t) => t.use_case === activePromptUseCase);
                  if (!current) {
                    return <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">Kein Template gefunden.</p>;
                  }
                  return (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                          Gesperrter System-Block (readonly)
                        </label>
                        <textarea
                          readOnly
                          value={current.system_locked}
                          rows={6}
                          className="w-full rounded border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                          Editierbarer System-Zusatz
                        </label>
                        <textarea
                          value={current.system_editable}
                          rows={4}
                          onChange={(e) =>
                            setPromptTemplates((prev) =>
                              prev.map((t) =>
                                t.use_case === current.use_case ? { ...t, system_editable: e.target.value } : t
                              )
                            )
                          }
                          className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                          Gesperrter User-Block (readonly)
                        </label>
                        <textarea
                          readOnly
                          value={current.user_locked}
                          rows={8}
                          className="w-full rounded border border-zinc-200 bg-zinc-100 px-2 py-1.5 font-mono text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                          Editierbarer User-Zusatz
                        </label>
                        <textarea
                          value={current.user_editable}
                          rows={4}
                          onChange={(e) =>
                            setPromptTemplates((prev) =>
                              prev.map((t) =>
                                t.use_case === current.use_case ? { ...t, user_editable: e.target.value } : t
                              )
                            )
                          }
                          className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Version: {current.version}
                        {current.updated_at ? ` · Aktualisiert: ${new Date(current.updated_at).toLocaleString('de-DE')}` : ''}
                      </p>
                    </div>
                  );
                })()
              )}

              <button
                type="button"
                onClick={handleSavePromptTemplates}
                disabled={promptLoading || promptTemplates.length === 0}
                className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {promptLoading ? 'Speichere Prompt-Bausteine…' : 'Prompt-Bausteine speichern'}
              </button>
              <button
                type="button"
                onClick={() => void handlePreviewPrompt('prompt_only')}
                disabled={promptPreviewLoading || promptTemplates.length === 0}
                className="ml-2 mt-3 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {promptPreviewLoading ? 'Lade Vorschau…' : 'Prompt-Vorschau (ohne LLM)'}
              </button>
              <button
                type="button"
                onClick={() => void handlePreviewPrompt('llm_test')}
                disabled={promptPreviewLoading || promptTemplates.length === 0}
                className="ml-2 mt-3 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {promptPreviewLoading ? 'Teste Prompt…' : 'Prompt testen (LLM)'}
              </button>
              <button
                type="button"
                onClick={() => void handleResetPromptTemplate()}
                disabled={promptLoading || promptTemplates.length === 0}
                className="ml-2 mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950"
              >
                Auf Default zuruecksetzen
              </button>
              {promptPreviewResult && (
                <pre className="mt-3 max-h-64 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                  {promptPreviewResult}
                </pre>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => {
              const next = !metadataPanelOpen;
              setMetadataPanelOpen(next);
              setPanelQuery({ meta: next });
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Metadaten pflegen</h2>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Schulspezifische Listen für Dokumenttypen und verantwortliche Einheiten.
              </p>
            </div>
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              aria-hidden="true"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`transition-transform ${metadataPanelOpen ? 'rotate-180' : ''}`}
              >
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          {metadataPanelOpen && (
            <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">

          {metaError && (
            <p className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {metaError}
            </p>
          )}
          {metaMessage && (
            <p className="mb-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
              {metaMessage}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">Dokumenttypen</p>
              <div className="space-y-2">
                {docTypeOptions.map((t, idx) => (
                  <div key={t.code} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(t.active)}
                      onChange={(e) =>
                        setDocTypeOptions((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, active: e.target.checked } : p))
                        )
                      }
                      className="rounded"
                      title="Aktiv"
                    />
                    <span className="w-[110px] truncate text-[11px] text-zinc-500" title={t.code}>
                      {t.code}
                    </span>
                    <input
                      type="text"
                      value={t.label}
                      onChange={(e) =>
                        setDocTypeOptions((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p))
                        )
                      }
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                      placeholder="Label"
                    />
                    <button
                      type="button"
                      onClick={() => setDocTypeOptions((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      title="Entfernen"
                    >
                      Entfernen
                    </button>
                  </div>
                ))}
                {docTypeOptions.length === 0 && (
                  <p className="text-[11px] text-zinc-500">Keine Dokumenttypen gefunden.</p>
                )}

                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <input
                    type="text"
                    value={newDocTypeCode}
                    onChange={(e) => setNewDocTypeCode(e.target.value)}
                    className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Code (z. B. PROTOKOLL)"
                  />
                  <input
                    type="text"
                    value={newDocTypeLabel}
                    onChange={(e) => setNewDocTypeLabel(e.target.value)}
                    className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Label (z. B. Protokoll)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const code = newDocTypeCode.trim().toUpperCase();
                      const label = newDocTypeLabel.trim();
                      if (!code || !label) return;
                      if (docTypeOptions.some((x) => x.code.trim().toUpperCase() === code)) return;
                      setDocTypeOptions((prev) => [
                        ...prev,
                        { code, label, active: true, sort_order: prev.length * 10 },
                      ]);
                      setNewDocTypeCode('');
                      setNewDocTypeLabel('');
                    }}
                    className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">Verantwortlich</p>
              <div className="space-y-2">
                {responsibleUnitOptions.map((u, idx) => (
                  <div key={u.name} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(u.active)}
                      onChange={(e) =>
                        setResponsibleUnitOptions((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, active: e.target.checked } : p))
                        )
                      }
                      className="rounded"
                      title="Aktiv"
                    />
                    <input
                      type="text"
                      value={u.name}
                      onChange={(e) =>
                        setResponsibleUnitOptions((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p))
                        )
                      }
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                      placeholder="Name"
                    />
                    <button
                      type="button"
                      onClick={() => setResponsibleUnitOptions((prev) => prev.filter((_, i) => i !== idx))}
                      className="rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      title="Entfernen"
                    >
                      Entfernen
                    </button>
                  </div>
                ))}

                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newRespUnit}
                    onChange={(e) => setNewRespUnit(e.target.value)}
                    className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Neue Verantwortlich-Gruppe hinzufügen"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = newRespUnit.trim();
                      if (!v) return;
                      if (responsibleUnitOptions.some((x) => x.name.trim().toLowerCase() === v.toLowerCase())) return;
                      setResponsibleUnitOptions((prev) => [...prev, { name: v, active: true, sort_order: prev.length * 10 }]);
                      setNewRespUnit('');
                    }}
                    className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>
            </div>
          </div>

              <button
                type="button"
                onClick={handleSaveMetadata}
                disabled={metaLoading}
                className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {metaLoading ? 'Speichere…' : 'Metadaten speichern'}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
