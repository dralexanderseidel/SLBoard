'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type AppUser = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  org_unit: string;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppUser>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    full_name: '',
    email: '',
    org_unit: 'Schulleitung',
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Anlegen.');
      setUsers((prev) => [...prev, data.user]);
      setCreateForm({ username: '', full_name: '', email: '', org_unit: 'Schulleitung' });
      setShowCreate(false);
      setMessage('Nutzer angelegt.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Anlegen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
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
