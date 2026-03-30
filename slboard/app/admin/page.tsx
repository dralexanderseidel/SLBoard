'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

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

export default function AdminPage() {
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
    debug_log_enabled: false,
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
          debug_log_enabled: Boolean(s.debug_log_enabled),
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
            <h1 className="text-xl font-semibold">Admin – Benutzerverwaltung</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Tabelle app_users bearbeiten, Rollen zuweisen.
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
            <button
              type="button"
              onClick={() => setShowCreate(!showCreate)}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              {showCreate ? 'Abbrechen' : 'Neuer Nutzer'}
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

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">KI-Konfiguration</h2>
          <p className="mb-3 text-[11px] text-zinc-600 dark:text-zinc-400">
            Diese Einstellungen gelten pro Schule und beeinflussen u. a. Chunking und Debug-Logging der KI-Anfragen.
          </p>

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
        </section>

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
                  {ORG_UNITS.map((ou) => (
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
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Lade Nutzer…</p>
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
                          {ORG_UNITS.map((ou) => (
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
    </main>
  );
}
