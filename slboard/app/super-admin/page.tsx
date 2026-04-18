'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

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
  quota_max_users: number | null;
  quota_max_documents: number | null;
  quota_max_ai_queries_per_month: number | null;
  usage: SchoolUsage;
};

type Draft = {
  name: string;
  active: boolean;
  quota_max_users: string;
  quota_max_documents: string;
  quota_max_ai_queries_per_month: string;
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

function draftFromSchoolPayload(s: SchoolPatchPayload): Draft {
  return {
    name: s.name,
    active: s.active,
    quota_max_users: s.quota_max_users === null ? '' : String(s.quota_max_users),
    quota_max_documents: s.quota_max_documents === null ? '' : String(s.quota_max_documents),
    quota_max_ai_queries_per_month:
      s.quota_max_ai_queries_per_month === null ? '' : String(s.quota_max_ai_queries_per_month),
  };
}

type SchoolRowProps = {
  school: SchoolRow;
  draft: Draft;
  schoolNumber: string;
  saving: boolean;
  updateDraft: (schoolNumber: string, patch: Partial<Draft>) => void;
  onSave: (schoolNumber: string) => void;
};

const SuperAdminSchoolRow = memo(function SuperAdminSchoolRow({
  school,
  draft,
  schoolNumber,
  saving,
  updateDraft,
  onSave,
}: SchoolRowProps) {
  const qUsers = school.quota_max_users;
  const qDocs = school.quota_max_documents;

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
      <td className="p-2">
        <button
          type="button"
          onClick={() => onSave(schoolNumber)}
          disabled={saving}
          className="whitespace-nowrap rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          {saving ? '…' : 'Speichern'}
        </button>
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
    if (qu === undefined || qd === undefined || qa === undefined) {
      setError('Quotas: nur nicht-negative Zahlen oder leer (= unbegrenzt).');
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
      <main className="mx-auto max-w-3xl px-6 py-10">
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
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
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
              KI „Monat“ = Kalendermonat (Serverzeit). Quotas: leeres Feld = unbegrenzt.
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
            <table className="min-w-[1200px] w-full border-collapse text-left text-xs">
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
                  <th className="p-2 font-medium" />
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
                      updateDraft={updateDraft}
                      onSave={saveSchool}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
