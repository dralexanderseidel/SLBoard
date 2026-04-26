'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MIN_APP_PASSWORD_LENGTH } from '@/lib/authPasswordConstants';
import { DEFAULT_ORG_UNIT_NAMES } from '@/lib/documentMeta';
import { CollapsibleSection } from './CollapsibleSection';
import type { AppUser } from '../types';
import { AVAILABLE_ROLES } from '../types';

type Props = {
  open: boolean;
  onToggle: (next: boolean) => void;
  onAdminStatusChange: (allowed: boolean) => void;
};

export function UsersPanel({ open, onToggle, onAdminStatusChange }: Props) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppUser>>({});
  const [editTempPassword, setEditTempPassword] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createUserSchoolNumber, setCreateUserSchoolNumber] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    username: '', full_name: '', email: '', org_unit: 'Schulleitung', school_number: '', temporary_password: '',
  });
  const [saving, setSaving] = useState(false);
  const [savingRoleUserIds, setSavingRoleUserIds] = useState(new Set<string>());
  const roleAbortControllers = useRef(new Map<string, AbortController>());
  const [activeOrgUnits, setActiveOrgUnits] = useState<string[]>(DEFAULT_ORG_UNIT_NAMES);

  useEffect(() => {
    fetch('/api/metadata/options', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { responsibleUnits?: string[] }) => {
        if (Array.isArray(data.responsibleUnits) && data.responsibleUnits.length > 0) {
          setActiveOrgUnits(data.responsibleUnits);
        }
      })
      .catch(() => {});
  }, []);

  const orgUnitSelectOptions = useCallback((current?: string): string[] => {
    const cur = (current ?? '').trim();
    if (!cur) return activeOrgUnits;
    return activeOrgUnits.includes(cur) ? activeOrgUnits : [cur, ...activeOrgUnits];
  }, [activeOrgUnits]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setError(data.error ?? 'Keine Admin-Berechtigung.');
          onAdminStatusChange(false);
          setUsers([]);
          setCreateUserSchoolNumber(null);
          return;
        }
        const msg = data.error ?? 'Fehler beim Laden.';
        if (res.status === 401 && msg.includes('Anmeldung')) {
          setError(`${msg} Falls Sie bereits angemeldet sind: Bitte melden Sie sich ab und erneut an, damit die Sitzung funktioniert.`);
        } else {
          setError(msg);
        }
        onAdminStatusChange(false);
        setUsers([]);
        setCreateUserSchoolNumber(null);
        return;
      }
      onAdminStatusChange(true);
      setUsers(data.users ?? []);
      setCreateUserSchoolNumber(
        typeof data.createUserSchoolNumber === 'string' && /^\d{6}$/.test(data.createUserSchoolNumber)
          ? data.createUserSchoolNumber
          : null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden der Nutzer.');
      onAdminStatusChange(false);
      setUsers([]);
      setCreateUserSchoolNumber(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUsers(); }, []);

  useEffect(() => {
    if (createUserSchoolNumber) {
      setCreateForm((f) => ({ ...f, school_number: createUserSchoolNumber }));
    }
  }, [createUserSchoolNumber]);

  const handleEdit = (u: AppUser) => {
    setEditingId(u.id);
    setEditTempPassword('');
    setEditForm({
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      org_unit: u.org_unit,
      active: u.active !== false,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const tp = editTempPassword.trim();
    if (tp && tp.length < MIN_APP_PASSWORD_LENGTH) {
      setError(`Temporäres Passwort: mindestens ${MIN_APP_PASSWORD_LENGTH} Zeichen oder leer lassen.`);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = { ...editForm };
      if (tp) payload.temporary_password = tp;
      if (typeof editForm.active === 'boolean') {
        payload.active = editForm.active;
      }
      const res = await fetch(`/api/admin/users/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Speichern.');
      const updated = data.user as AppUser | undefined;
      setUsers((prev) => prev.map((u) => {
        if (u.id !== editingId) return u;
        if (updated) return { ...u, ...updated, roles: u.roles };
        return { ...u, ...editForm } as AppUser;
      }));
      setEditingId(null);
      setEditTempPassword('');
      setMessage(tp ? 'Nutzer aktualisiert und Passwort gesetzt.' : 'Nutzer aktualisiert.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const handleRolesChange = async (userId: string, newRoles: string[]) => {
    // Sofortiges optimistisches Update – kein globales Sperren der Oberfläche
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, roles: newRoles } : u)));

    // Laufende Anfrage für denselben Nutzer abbrechen
    roleAbortControllers.current.get(userId)?.abort();
    const controller = new AbortController();
    roleAbortControllers.current.set(userId, controller);
    setSavingRoleUserIds((prev) => new Set([...prev, userId]));
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: newRoles }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Speichern der Rollen.');
      setMessage('Rollen aktualisiert.');
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern.');
    } finally {
      roleAbortControllers.current.delete(userId);
      setSavingRoleUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleDeleteUser = async (u: AppUser) => {
    if (u.deletable === false) return;
    const ok = window.confirm(
      `Nutzer „${u.full_name}" (${u.email}) wirklich löschen?\n\n` +
      'Der Eintrag in app_users wird entfernt; der zugehörige Supabase-Auth-User wird ebenfalls gelöscht, falls vorhanden.'
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Löschen fehlgeschlagen.');
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      if (editingId === u.id) setEditingId(null);
      setMessage('Nutzer gelöscht.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.');
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
    const tp = createForm.temporary_password.trim();
    if (tp && tp.length < MIN_APP_PASSWORD_LENGTH) {
      setError(`Temporäres Passwort: mindestens ${MIN_APP_PASSWORD_LENGTH} Zeichen oder leer lassen.`);
      return;
    }
    const schoolNum = (createUserSchoolNumber ?? createForm.school_number).trim();
    if (!/^\d{6}$/.test(schoolNum)) {
      setError('Schulnummer (6-stellig) ist erforderlich.');
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
          username: createForm.username,
          full_name: createForm.full_name,
          email: createForm.email,
          org_unit: createForm.org_unit,
          school_number: schoolNum,
          ...(tp ? { temporary_password: tp } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Anlegen.');
      setUsers((prev) => [...prev, data.user]);
      setCreateForm({
        username: '', full_name: '', email: '', org_unit: 'Schulleitung',
        school_number: createUserSchoolNumber ?? '', temporary_password: '',
      });
      setShowCreate(false);
      setMessage('Nutzer angelegt.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Anlegen.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950';

  return (
    <CollapsibleSection
      title="Nutzer & Rollen"
      description="Benutzerverwaltung inkl. Rollen und Organisationseinheiten."
      open={open}
      onToggle={onToggle}
    >
      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
          {message}
        </p>
      )}

      <div className="space-y-4">
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
                <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Benutzername *</label>
                <input type="text" value={createForm.username}
                  onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                  className={inputClass} placeholder="z.B. mueller" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Vollständiger Name *</label>
                <input type="text" value={createForm.full_name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                  className={inputClass} placeholder="z.B. Dr. Anna Müller" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">E-Mail *</label>
                <input type="email" value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass} placeholder="leitung@schule.de" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Schulnummer</label>
                {createUserSchoolNumber ? (
                  <>
                    <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-100">
                      {createUserSchoolNumber}
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                      Vorgegeben für Ihre aktuelle Schule; andere Schulnummern sind nicht wählbar.
                    </p>
                  </>
                ) : (
                  <>
                    <input type="text" value={createForm.school_number}
                      onChange={(e) => setCreateForm((f) => ({ ...f, school_number: e.target.value }))}
                      className={inputClass} placeholder="6-stellig, z.B. 123456" />
                    <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                      Nur nötig, wenn kein Schul-Kontext gesetzt ist (z. B. zentrale Verwaltung).
                    </p>
                  </>
                )}
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Organisationseinheit</label>
                <select value={createForm.org_unit}
                  onChange={(e) => setCreateForm((f) => ({ ...f, org_unit: e.target.value }))}
                  className={inputClass}>
                  {orgUnitSelectOptions(createForm.org_unit).map((ou) => (
                    <option key={ou} value={ou}>{ou}</option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                  Dieselbe Liste wie unter Metadaten → Verantwortlich. Abweichende Einträge eines Nutzers
                  erscheinen zusätzlich in der Auswahl.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                  Temporäres Passwort (Login)
                </label>
                <input type="password" autoComplete="new-password" value={createForm.temporary_password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, temporary_password: e.target.value }))}
                  className={inputClass} placeholder={`min. ${MIN_APP_PASSWORD_LENGTH} Zeichen; optional`} />
                <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                  Wenn gesetzt, kann sich der Nutzer damit anmelden und das Passwort später unter dem Profilbild ändern.
                </p>
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Wird angelegt…' : 'Nutzer anlegen'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="p-3">
              <div className="mb-3 h-4 w-36 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                ))}
              </div>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Lade Nutzer…</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full min-w-[70rem] table-auto text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="min-w-[9rem] p-3 font-semibold text-zinc-800 dark:text-zinc-100">Benutzer</th>
                  <th className="min-w-[13rem] max-w-[18rem] p-3 font-semibold text-zinc-800 dark:text-zinc-100">
                    E-Mail
                  </th>
                  <th className="w-24 min-w-[6.5rem] p-3 font-semibold text-zinc-800 dark:text-zinc-100">
                    Schulnr.
                  </th>
                  <th className="min-w-[6.5rem] w-[6.5rem] p-3 font-semibold text-zinc-800 dark:text-zinc-100">
                    Aktiv
                  </th>
                  <th className="min-w-[8rem] p-3 font-semibold text-zinc-800 dark:text-zinc-100">Org.-Einheit</th>
                  <th className="min-w-[12rem] p-3 font-semibold text-zinc-800 dark:text-zinc-100">Rollen</th>
                  <th className="min-w-[8rem] w-[8rem] p-3 font-semibold text-zinc-800 dark:text-zinc-100">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="align-top p-3">
                      {editingId === u.id ? (
                        <div className="min-w-0 space-y-2.5">
                          <input type="text" value={editForm.username ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                            className="w-full min-w-0 rounded border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                            placeholder="Benutzername" />
                          <input type="text" value={editForm.full_name ?? ''}
                            onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                            className="w-full min-w-0 rounded border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                            placeholder="Vollständiger Name" />
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                              Neues temporäres Passwort (optional)
                            </label>
                            <input type="password" autoComplete="new-password" value={editTempPassword}
                              onChange={(e) => setEditTempPassword(e.target.value)}
                              className="w-full min-w-0 rounded border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                              placeholder={`min. ${MIN_APP_PASSWORD_LENGTH} Zeichen`} />
                          </div>
                          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-300">
                            <input
                              type="checkbox"
                              checked={editForm.active !== false}
                              disabled={u.deletable === false}
                              onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                              className="rounded"
                            />
                            Konto aktiv (Schulzugriff)
                            {u.deletable === false && (
                              <span className="text-[10px] text-zinc-500">Registrierungs-Admin</span>
                            )}
                          </label>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <div className="font-medium leading-snug">{u.full_name}</div>
                          <div className="mt-0.5 text-[11px] text-zinc-500">{u.username}</div>
                        </div>
                      )}
                    </td>
                    <td className="max-w-[18rem] min-w-0 p-3 align-top">
                      {editingId === u.id ? (
                        <input
                          type="email"
                          value={editForm.email ?? ''}
                          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                          className="w-full min-w-0 rounded border px-2 py-1 text-xs"
                        />
                      ) : (
                        <div className="min-w-0">
                          <span className="break-all text-zinc-700 dark:text-zinc-300">{u.email}</span>
                          {u.password_change_required && (
                            <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                              Muss initiales Passwort bei der Anmeldung wechseln
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3 align-top font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {u.school_number ?? '—'}
                    </td>
                    <td className="p-3 align-top text-sm text-zinc-700 dark:text-zinc-300">
                      {editingId === u.id ? (
                        <span className="text-zinc-500 dark:text-zinc-400">siehe links</span>
                      ) : u.active === false ? (
                        <span className="inline-block rounded bg-zinc-200 px-2 py-1 text-sm font-medium text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50">
                          Inaktiv
                        </span>
                      ) : (
                        <span className="text-zinc-600 dark:text-zinc-400">Ja</span>
                      )}
                    </td>
                    <td className="align-top p-3">
                      {editingId === u.id ? (
                        <select value={editForm.org_unit ?? ''}
                          onChange={(e) => setEditForm((f) => ({ ...f, org_unit: e.target.value }))}
                          className="rounded border px-2 py-1 text-xs">
                          {orgUnitSelectOptions(editForm.org_unit as string | undefined).map((ou) => (
                            <option key={ou} value={ou}>{ou}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-block leading-snug">{u.org_unit}</span>
                      )}
                    </td>
                    <td className="align-top p-3">
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_ROLES.map((role) => {
                          const checked = u.roles.includes(role);
                          return (
                            <label key={role} className="flex items-center gap-1 text-[11px]">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const newRoles = e.target.checked
                                    ? [...u.roles, role]
                                    : u.roles.filter((r) => r !== role);
                                  void handleRolesChange(u.id, newRoles);
                                }}
                                disabled={savingRoleUserIds.has(u.id)}
                                className="rounded"
                              />
                              {role}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                    <td className="align-top p-3">
                      {editingId === u.id ? (
                        <div className="flex min-w-[7.25rem] flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit()}
                            disabled={saving}
                            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {saving ? '…' : 'Speichern'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditTempPassword('');
                            }}
                            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            Abbrechen
                          </button>
                        </div>
                      ) : (
                        <div className="flex min-w-[7.25rem] flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(u)}
                            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            Bearbeiten
                          </button>
                          {u.deletable !== false && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteUser(u)}
                              disabled={saving}
                              className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                            >
                              Löschen
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
