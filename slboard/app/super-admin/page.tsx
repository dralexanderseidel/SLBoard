'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MIN_APP_PASSWORD_LENGTH } from '@/lib/authPasswordConstants';
import { APP_PAGE_MAX_OUTER_CLASS } from '@/lib/appPageLayout';

type SchoolUsage = {
  userCount: number;
  documentCount: number;
  aiQueriesTotal: number;
  aiQueriesThisMonth: number;
  llmCallsTotal: number;
  llmCallsThisMonth: number;
};

type SchoolRow = {
  school_number: string;
  name: string;
  active: boolean;
  created_at: string;
  initial_admin_app_user_id: string | null;
  /** Aus app_users, für Super-Admin-Passwort-Reset */
  initial_admin_email: string | null;
  initial_admin_full_name: string | null;
  quota_max_users: number | null;
  quota_max_documents: number | null;
  quota_max_ai_queries_per_month: number | null;
  feature_ai_enabled?: boolean;
  feature_drafts_enabled?: boolean;
  max_upload_file_mb?: number | null;
  usage: SchoolUsage;
};

type Draft = {
  name: string;
  active: boolean;
  quota_max_users: string;
  quota_max_documents: string;
  quota_max_ai_queries_per_month: string;
  feature_ai_enabled: boolean;
  feature_drafts_enabled: boolean;
  max_upload_file_mb: string;
};

/** API-Shape von PATCH /api/super-admin/schools/[id] (ohne usage) */
type SchoolPatchPayload = {
  school_number: string;
  name: string;
  active: boolean;
  created_at: string;
  initial_admin_app_user_id: string | null;
  quota_max_users: number | null;
  quota_max_documents: number | null;
  quota_max_ai_queries_per_month: number | null;
  feature_ai_enabled: boolean;
  feature_drafts_enabled: boolean;
  max_upload_file_mb: number | null;
};

function fmtQuota(used: number, max: number | null): string {
  if (max === null || max === undefined) return `${used.toLocaleString('de-DE')} / ∞`;
  return `${used.toLocaleString('de-DE')} / ${max.toLocaleString('de-DE')}`;
}

function parseDraftInt(s: string): number | null | undefined {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

/** Leer = Plattform-Standard (NULL in DB); sonst 1–100 MB. */
function parseMaxUploadMbDraft(s: string): number | null | undefined {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i < 1 || i > 100) return undefined;
  return i;
}

function draftFromSchoolPayload(s: SchoolPatchPayload): Draft {
  return {
    name: s.name,
    active: s.active,
    quota_max_users: s.quota_max_users === null ? '' : String(s.quota_max_users),
    quota_max_documents: s.quota_max_documents === null ? '' : String(s.quota_max_documents),
    quota_max_ai_queries_per_month:
      s.quota_max_ai_queries_per_month === null ? '' : String(s.quota_max_ai_queries_per_month),
    feature_ai_enabled: s.feature_ai_enabled !== false,
    feature_drafts_enabled: s.feature_drafts_enabled !== false,
    max_upload_file_mb: s.max_upload_file_mb == null ? '' : String(s.max_upload_file_mb),
  };
}

/** UI-Hinweis: gleiche Regeln wie API (Dokumente 0, genau ein Nutzer = Erst-Admin). */
function schoolRowDeletable(s: SchoolRow): boolean {
  return (
    s.school_number !== '000000' &&
    s.initial_admin_app_user_id != null &&
    s.usage.documentCount === 0 &&
    s.usage.userCount === 1
  );
}

type SchoolRowProps = {
  school: SchoolRow;
  draft: Draft;
  schoolNumber: string;
  saving: boolean;
  deleting: boolean;
  canDelete: boolean;
  updateDraft: (schoolNumber: string, patch: Partial<Draft>) => void;
  onSave: (schoolNumber: string) => void;
  onDelete: (schoolNumber: string, displayName: string) => void;
  onOpenPasswordReset: (school: SchoolRow) => void;
};

const SuperAdminSchoolRow = memo(function SuperAdminSchoolRow({
  school,
  draft,
  schoolNumber,
  saving,
  deleting,
  canDelete,
  updateDraft,
  onSave,
  onDelete,
  onOpenPasswordReset,
}: SchoolRowProps) {
  const qUsers = school.quota_max_users;
  const qDocs = school.quota_max_documents;
  const hasInitialAdmin = Boolean(school.initial_admin_app_user_id);

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="p-2 font-mono text-[11px]">{school.school_number}</td>
      <td className="p-2">
        <input
          value={draft.name}
          onChange={(e) => updateDraft(schoolNumber, { name: e.target.value })}
          className="w-full min-w-[140px] rounded border border-zinc-300 px-1 py-0.5 dark:border-zinc-600 dark:bg-zinc-950"
        />
      </td>
      <td className="p-2">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => updateDraft(schoolNumber, { active: e.target.checked })}
          className="rounded"
        />
      </td>
      <td className="p-2 tabular-nums" title="Ist-Nutzer / Quota">
        {fmtQuota(school.usage.userCount, qUsers)}
      </td>
      <td className="p-2 tabular-nums" title="Ist-Dokumente / Quota">
        {fmtQuota(school.usage.documentCount, qDocs)}
      </td>
      <td className="p-2 tabular-nums text-zinc-500 dark:text-zinc-400">
        {(school.usage.llmCallsTotal ?? 0).toLocaleString('de-DE')}
      </td>
      <td className="p-2 tabular-nums text-zinc-500 dark:text-zinc-400">
        {(school.usage.llmCallsThisMonth ?? 0).toLocaleString('de-DE')}
      </td>
      <td className="p-2 tabular-nums text-zinc-500 dark:text-zinc-400">
        {(school.usage.aiQueriesTotal ?? 0).toLocaleString('de-DE')}
      </td>
      <td className="p-2 tabular-nums text-zinc-500 dark:text-zinc-400">
        {(school.usage.aiQueriesThisMonth ?? 0).toLocaleString('de-DE')}
      </td>
      <td className="p-2">
        <input
          value={draft.quota_max_users}
          onChange={(e) => updateDraft(schoolNumber, { quota_max_users: e.target.value })}
          className="w-16 rounded border border-zinc-300 px-1 py-0.5 dark:border-zinc-600 dark:bg-zinc-950"
          inputMode="numeric"
          placeholder="∞"
        />
      </td>
      <td className="p-2">
        <input
          value={draft.quota_max_documents}
          onChange={(e) => updateDraft(schoolNumber, { quota_max_documents: e.target.value })}
          className="w-16 rounded border border-zinc-300 px-1 py-0.5 dark:border-zinc-600 dark:bg-zinc-950"
          inputMode="numeric"
          placeholder="∞"
        />
      </td>
      <td className="p-2">
        <input
          value={draft.quota_max_ai_queries_per_month}
          onChange={(e) => updateDraft(schoolNumber, { quota_max_ai_queries_per_month: e.target.value })}
          className="w-20 rounded border border-zinc-300 px-1 py-0.5 dark:border-zinc-600 dark:bg-zinc-950"
          inputMode="numeric"
          placeholder="∞"
        />
      </td>
      <td className="p-2 text-center" title="KI-Funktionen (Fragen, Zusammenfassung, Steuerung, Entwürfe-KI)">
        <input
          type="checkbox"
          checked={draft.feature_ai_enabled}
          onChange={(e) => updateDraft(schoolNumber, { feature_ai_enabled: e.target.checked })}
          className="rounded"
        />
      </td>
      <td className="p-2 text-center" title="Entwurfsassistent (Seite /drafts und Übernahme)">
        <input
          type="checkbox"
          checked={draft.feature_drafts_enabled}
          onChange={(e) => updateDraft(schoolNumber, { feature_drafts_enabled: e.target.checked })}
          className="rounded"
        />
      </td>
      <td className="p-2">
        <input
          value={draft.max_upload_file_mb}
          onChange={(e) => updateDraft(schoolNumber, { max_upload_file_mb: e.target.value })}
          className="w-14 rounded border border-zinc-300 px-1 py-0.5 dark:border-zinc-600 dark:bg-zinc-950"
          inputMode="numeric"
          placeholder="20"
          title="Max. MB pro Upload (leer = Plattform-Standard 20 MB)"
        />
      </td>
      <td className="p-2">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onSave(schoolNumber)}
            disabled={saving || deleting}
            className="whitespace-nowrap rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            {saving ? '…' : 'Speichern'}
          </button>
          <button
            type="button"
            title={
              hasInitialAdmin
                ? 'Neues temporäres Passwort für den Schul-Erstadmin (Login + Pflichtwechsel)'
                : 'Kein Erst-Admin hinterlegt'
            }
            onClick={() => onOpenPasswordReset(school)}
            disabled={!hasInitialAdmin || saving || deleting}
            className="whitespace-nowrap rounded border border-amber-300 px-2 py-1 text-[11px] text-amber-950 hover:bg-amber-50 disabled:opacity-40 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
          >
            Admin-PW
          </button>
          <button
            type="button"
            title={
              canDelete
                ? 'Schule und Schuladmin endgültig löschen'
                : 'Nur möglich ohne Dokumente und mit genau einem Nutzer (Erst-Admin). Pilotschule 000000 nie.'
            }
            onClick={() => onDelete(schoolNumber, draft.name.trim() || school.name)}
            disabled={!canDelete || saving || deleting}
            className="whitespace-nowrap rounded border border-red-300 px-2 py-1 text-[11px] text-red-800 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
          >
            {deleting ? '…' : 'Löschen'}
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function SuperAdminPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [createSchoolNumber, setCreateSchoolNumber] = useState('');
  const [createSchoolName, setCreateSchoolName] = useState('');
  const [createAdminFullName, setCreateAdminFullName] = useState('');
  const [createAdminEmail, setCreateAdminEmail] = useState('');
  const [createAdminPassword, setCreateAdminPassword] = useState('');
  const [createQUsers, setCreateQUsers] = useState('');
  const [createQDocs, setCreateQDocs] = useState('');
  const [createQAi, setCreateQAi] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [pwResetSchool, setPwResetSchool] = useState<SchoolRow | null>(null);
  const [pwResetTemp, setPwResetTemp] = useState('');
  const [pwResetTemp2, setPwResetTemp2] = useState('');
  const [pwResetLoading, setPwResetLoading] = useState(false);
  const [pwResetError, setPwResetError] = useState<string | null>(null);
  const [pwResetMessage, setPwResetMessage] = useState<string | null>(null);

  const openPasswordReset = useCallback((school: SchoolRow) => {
    setPwResetSchool(school);
    setPwResetTemp('');
    setPwResetTemp2('');
    setPwResetError(null);
    setPwResetMessage(null);
  }, []);

  const closePasswordReset = useCallback(() => {
    setPwResetSchool(null);
    setPwResetTemp('');
    setPwResetTemp2('');
    setPwResetError(null);
    setPwResetMessage(null);
  }, []);

  const submitPasswordReset = useCallback(async () => {
    if (!pwResetSchool) return;
    const a = pwResetTemp.trim();
    const b = pwResetTemp2.trim();
    if (a.length < MIN_APP_PASSWORD_LENGTH) {
      setPwResetError(`Passwort: mindestens ${MIN_APP_PASSWORD_LENGTH} Zeichen.`);
      return;
    }
    if (a !== b) {
      setPwResetError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }
    setPwResetLoading(true);
    setPwResetError(null);
    setPwResetMessage(null);
    try {
      const res = await fetch(
        `/api/super-admin/schools/${encodeURIComponent(pwResetSchool.school_number)}/reset-initial-admin-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ temporaryPassword: a }),
        }
      );
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? 'Zurücksetzen fehlgeschlagen.');
      setPwResetMessage(data.message ?? 'Passwort wurde gesetzt.');
      setPwResetTemp('');
      setPwResetTemp2('');
    } catch (e) {
      setPwResetError(e instanceof Error ? e.message : 'Zurücksetzen fehlgeschlagen.');
    } finally {
      setPwResetLoading(false);
    }
  }, [pwResetSchool, pwResetTemp, pwResetTemp2]);

  const updateDraft = useCallback((schoolNumber: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [schoolNumber]: { ...prev[schoolNumber], ...patch },
    }));
  }, []);

  const loadSchools = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    if (mode === 'initial') {
      setForbidden(false);
    }
    try {
      const res = await fetch('/api/super-admin/schools', { credentials: 'include' });
      const data = await res.json();
      if (res.status === 403) {
        setForbidden(true);
        setSchools([]);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? 'Daten konnten nicht geladen werden.');
      const list = (data.schools ?? []) as SchoolRow[];
      setSchools(list);
      const next: Record<string, Draft> = {};
      for (const s of list) {
        next[s.school_number] = {
          name: s.name,
          active: s.active,
          quota_max_users: s.quota_max_users === null ? '' : String(s.quota_max_users),
          quota_max_documents: s.quota_max_documents === null ? '' : String(s.quota_max_documents),
          quota_max_ai_queries_per_month:
            s.quota_max_ai_queries_per_month === null ? '' : String(s.quota_max_ai_queries_per_month),
          feature_ai_enabled: s.feature_ai_enabled !== false,
          feature_drafts_enabled: s.feature_drafts_enabled !== false,
          max_upload_file_mb: s.max_upload_file_mb == null ? '' : String(s.max_upload_file_mb),
        };
      }
      setDrafts(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Daten konnten nicht geladen werden.');
      setSchools([]);
    } finally {
      if (mode === 'initial') {
        setInitialLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadSchools('initial');
  }, [loadSchools]);

  const saveSchool = useCallback(async (schoolNumber: string) => {
    const d = draftsRef.current[schoolNumber];
    if (!d) return;
    const qu = parseDraftInt(d.quota_max_users);
    const qd = parseDraftInt(d.quota_max_documents);
    const qa = parseDraftInt(d.quota_max_ai_queries_per_month);
    const maxUploadMb = parseMaxUploadMbDraft(d.max_upload_file_mb);
    if (qu === undefined || qd === undefined || qa === undefined) {
      setError('Quotas: nur nicht-negative Zahlen oder leer (= unbegrenzt).');
      return;
    }
    if (maxUploadMb === undefined) {
      setError('Max. Upload: leer (= Standard 20 MB) oder ganze Zahl 1–100.');
      return;
    }
    setSavingId(schoolNumber);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/schools/${encodeURIComponent(schoolNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: d.name.trim(),
          active: d.active,
          quota_max_users: qu,
          quota_max_documents: qd,
          quota_max_ai_queries_per_month: qa,
          feature_ai_enabled: d.feature_ai_enabled,
          feature_drafts_enabled: d.feature_drafts_enabled,
          max_upload_file_mb: maxUploadMb,
        }),
      });
      const data = (await res.json()) as { error?: string; school?: SchoolPatchPayload };
      if (!res.ok) throw new Error(data.error ?? 'Speichern fehlgeschlagen.');

      const updated = data.school;
      if (updated) {
        setSchools((prev) =>
          prev.map((row) =>
            row.school_number === schoolNumber
              ? {
                  ...row,
                  name: updated.name,
                  active: updated.active,
                  created_at: updated.created_at,
                  initial_admin_app_user_id: updated.initial_admin_app_user_id,
                  quota_max_users: updated.quota_max_users,
                  quota_max_documents: updated.quota_max_documents,
                  quota_max_ai_queries_per_month: updated.quota_max_ai_queries_per_month,
                }
              : row
          )
        );
        setDrafts((prev) => ({
          ...prev,
          [schoolNumber]: draftFromSchoolPayload(updated),
        }));
      } else {
        await loadSchools('refresh');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSavingId(null);
    }
  }, [loadSchools]);

  const deleteSchool = useCallback(
    async (schoolNumber: string, displayName: string) => {
      if (
        !window.confirm(
          `Schule unwiderruflich löschen?\n\n„${displayName}“ (${schoolNumber})\n\nEs werden die Schule, der Schuladmin (Auth) und schulspezifische Daten entfernt. Voraussetzungen: keine Dokumente, nur der Erst-Admin als Nutzer.`
        )
      ) {
        return;
      }
      setDeletingId(schoolNumber);
      setError(null);
      try {
        const res = await fetch(`/api/super-admin/schools/${encodeURIComponent(schoolNumber)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = (await res.json()) as { error?: string; message?: string };
        if (!res.ok) throw new Error(data.error ?? 'Löschen fehlgeschlagen.');
        await loadSchools('refresh');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.');
      } finally {
        setDeletingId(null);
      }
    },
    [loadSchools]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    setCreateMessage(null);
    try {
      const body: Record<string, unknown> = {
        schoolNumber: createSchoolNumber.trim(),
        schoolName: createSchoolName.trim(),
        adminFullName: createAdminFullName.trim(),
        adminEmail: createAdminEmail.trim(),
        adminPassword: createAdminPassword,
      };
      const pq = parseDraftInt(createQUsers);
      const pd = parseDraftInt(createQDocs);
      const pa = parseDraftInt(createQAi);
      if (pq === undefined || pd === undefined || pa === undefined) {
        throw new Error('Quotas: nur nicht-negative Zahlen oder leer (= unbegrenzt).');
      }
      if (createQUsers.trim() !== '') body.quota_max_users = pq;
      if (createQDocs.trim() !== '') body.quota_max_documents = pd;
      if (createQAi.trim() !== '') body.quota_max_ai_queries_per_month = pa;

      const res = await fetch('/api/super-admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Anlage fehlgeschlagen.');
      setCreateMessage(data.message ?? 'Schule angelegt.');
      setCreateSchoolNumber('');
      setCreateSchoolName('');
      setCreateAdminFullName('');
      setCreateAdminEmail('');
      setCreateAdminPassword('');
      setCreateQUsers('');
      setCreateQDocs('');
      setCreateQAi('');
      await loadSchools('refresh');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Anlage fehlgeschlagen.');
    } finally {
      setCreateLoading(false);
    }
  };

  if (forbidden) {
    return (
      <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className={`${APP_PAGE_MAX_OUTER_CLASS} py-6 sm:py-10`}>
          <div className="max-w-3xl">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Super-Admin</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Sie haben keine Super-Admin-Berechtigung. Zugriff erhalten Sie über die Umgebungsvariable{' '}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">SUPER_ADMIN_EMAILS</code> oder die Rolle{' '}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">SUPER_ADMIN</code> in{' '}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">user_roles</code>.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
          Zurück zur Startseite
        </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className={`${APP_PAGE_MAX_OUTER_CLASS} py-6 sm:py-8`}>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Super-Admin</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Schulen anlegen, Nutzung einsehen und Quotas (Tarife) pro Schule festlegen.
          </p>
        </div>
        <Link href="/" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          Zurück
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Neue Schule mit Schuladmin</h2>
        <p className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          Schulnummer 6-stellig, Schuladmin erhält Zugang per E-Mail/Passwort (wie bei der öffentlichen Schulregistrierung).
        </p>
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
          <label className="text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">Schulnummer</span>
            <input
              value={createSchoolNumber}
              onChange={(e) => setCreateSchoolNumber(e.target.value)}
              className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              placeholder="123456"
              maxLength={6}
              required
            />
          </label>
          <label className="text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">Schulname</span>
            <input
              value={createSchoolName}
              onChange={(e) => setCreateSchoolName(e.target.value)}
              className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              required
            />
          </label>
          <label className="text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">Name Schuladmin</span>
            <input
              value={createAdminFullName}
              onChange={(e) => setCreateAdminFullName(e.target.value)}
              className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              required
            />
          </label>
          <label className="text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">E-Mail Schuladmin</span>
            <input
              type="email"
              value={createAdminEmail}
              onChange={(e) => setCreateAdminEmail(e.target.value)}
              className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              required
            />
          </label>
          <label className="text-xs md:col-span-2">
            <span className="text-zinc-600 dark:text-zinc-400">Passwort Schuladmin (min. 10 Zeichen)</span>
            <input
              type="password"
              value={createAdminPassword}
              onChange={(e) => setCreateAdminPassword(e.target.value)}
              className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              autoComplete="new-password"
              required
              minLength={10}
            />
          </label>
          <div className="md:col-span-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <p className="mb-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Optionale Quotas (leer = unbegrenzt)</p>
            <div className="grid gap-2 md:grid-cols-3">
              <label className="text-xs">
                Max. Nutzer
                <input
                  value={createQUsers}
                  onChange={(e) => setCreateQUsers(e.target.value)}
                  className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  inputMode="numeric"
                />
              </label>
              <label className="text-xs">
                Max. Dokumente
                <input
                  value={createQDocs}
                  onChange={(e) => setCreateQDocs(e.target.value)}
                  className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  inputMode="numeric"
                />
              </label>
              <label className="text-xs">
                Max. KI-Anfragen / Monat
                <input
                  value={createQAi}
                  onChange={(e) => setCreateQAi(e.target.value)}
                  className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                  inputMode="numeric"
                />
              </label>
            </div>
          </div>
          {createError && (
            <p className="md:col-span-2 text-sm text-red-600 dark:text-red-400">{createError}</p>
          )}
          {createMessage && (
            <p className="md:col-span-2 text-sm text-green-700 dark:text-green-400">{createMessage}</p>
          )}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={createLoading}
              className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {createLoading ? 'Wird angelegt…' : 'Schule anlegen'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Schulen & Statistik</h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              KI „Monat“ = Kalendermonat (Serverzeit). Quotas: leeres Feld = unbegrenzt. Löschen nur wenn keine
              Dokumente und genau ein Nutzer (Erst-Admin); Pilotschule 000000 ist geschützt.
            </p>
          </div>
          {refreshing && (
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Liste wird aktualisiert…</span>
          )}
        </div>
        <div className="overflow-x-auto p-2">
          {initialLoading ? (
            <p className="p-4 text-sm text-zinc-500">Lade…</p>
          ) : (
            <table className="min-w-[1480px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                  <th className="p-2 font-medium">Nr.</th>
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium">Aktiv</th>
                  <th className="p-2 font-medium" title="Ist-Nutzer / Quota">
                    Nutzer
                  </th>
                  <th className="p-2 font-medium" title="Ist-Dokumente / Quota">
                    Dokumente
                  </th>
                  <th
                    className="p-2 font-medium"
                    title="Direkte LLM-Aufrufe (Zusammenfassungen, Entwürfe, Q&A …) gesamt"
                  >
                    LLM-Aufrufe ges.
                  </th>
                  <th className="p-2 font-medium" title="Direkte LLM-Aufrufe im laufenden Monat">
                    LLM-Aufrufe Mo.
                  </th>
                  <th className="p-2 font-medium" title="Dashboard-KI-Fragen gesamt">
                    KI-Anfragen ges.
                  </th>
                  <th className="p-2 font-medium" title="Dashboard-KI-Fragen im laufenden Monat">
                    KI-Anfragen Mo.
                  </th>
                  <th className="p-2 font-medium">Quota Nutzer</th>
                  <th className="p-2 font-medium">Quota Dok.</th>
                  <th className="p-2 font-medium">Quota KI/Monat</th>
                  <th className="p-2 font-medium" title="KI-Funktionen für diese Schule">
                    KI
                  </th>
                  <th className="p-2 font-medium" title="Entwurfsassistent">
                    Entw.
                  </th>
                  <th className="p-2 font-medium" title="Max. MB pro Datei (Upload & neue Version); leer = 20 MB">
                    Max MB
                  </th>
                  <th
                    className="p-2 font-medium"
                    title="Speichern · Admin-PW (Erst-Admin) · Löschen (nur ohne Dokumente, ein Nutzer = Erst-Admin)"
                  >
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => {
                  const d = drafts[s.school_number];
                  if (!d) return null;
                  return (
                    <SuperAdminSchoolRow
                      key={s.school_number}
                      schoolNumber={s.school_number}
                      school={s}
                      draft={d}
                      saving={savingId === s.school_number}
                      deleting={deletingId === s.school_number}
                      canDelete={schoolRowDeletable(s)}
                      updateDraft={updateDraft}
                      onSave={saveSchool}
                      onDelete={deleteSchool}
                      onOpenPasswordReset={openPasswordReset}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      </div>

      {pwResetSchool && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pw-reset-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePasswordReset();
          }}
        >
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="pw-reset-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Schuladmin-Passwort zurücksetzen
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Schule{' '}
              <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                {pwResetSchool.school_number}
              </span>{' '}
              ({pwResetSchool.name}). Es wird das Login des{' '}
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">Erst-Admins</strong> gesetzt (wie bei
              der Schul-Anlage hinterlegt).
            </p>
            {(pwResetSchool.initial_admin_full_name || pwResetSchool.initial_admin_email) && (
              <p className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-100">
                {pwResetSchool.initial_admin_full_name ? (
                  <span className="font-medium">{pwResetSchool.initial_admin_full_name}</span>
                ) : null}
                {pwResetSchool.initial_admin_full_name && pwResetSchool.initial_admin_email ? ' · ' : null}
                {pwResetSchool.initial_admin_email ? (
                  <span className="break-all">{pwResetSchool.initial_admin_email}</span>
                ) : null}
              </p>
            )}
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Neues temporäres Passwort (min. {MIN_APP_PASSWORD_LENGTH} Zeichen)
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pwResetTemp}
                  onChange={(e) => setPwResetTemp(e.target.value)}
                  className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Passwort wiederholen
                <input
                  type="password"
                  autoComplete="new-password"
                  value={pwResetTemp2}
                  onChange={(e) => setPwResetTemp2(e.target.value)}
                  className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
            </div>
            {pwResetError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{pwResetError}</p>
            )}
            {pwResetMessage && (
              <p className="mt-2 text-xs text-green-700 dark:text-green-400">{pwResetMessage}</p>
            )}
            <p className="mt-2 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
              Teilen Sie das Passwort dem Schuladmin nur über einen sicheren Kanal mit. Nach der Anmeldung muss ein
              neues Passwort gewählt werden.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closePasswordReset}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {pwResetMessage ? 'Schließen' : 'Abbrechen'}
              </button>
              {!pwResetMessage && (
                <button
                  type="button"
                  disabled={pwResetLoading}
                  onClick={() => void submitPasswordReset()}
                  className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {pwResetLoading ? 'Wird gesetzt…' : 'Passwort setzen'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
