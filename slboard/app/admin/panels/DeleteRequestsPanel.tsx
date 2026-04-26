'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';

type DeleteRequestRow = {
  id: string;
  school_number: string;
  app_user_id: string;
  email: string;
  requested_at: string;
  status: string;
  admin_note: string | null;
  resolved_at: string | null;
  resolved_by_app_user_id: string | null;
  app_user_label?: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Offen',
  acknowledged: 'Zur Kenntnis genommen',
  completed: 'Erledigt',
  rejected: 'Abgelehnt',
};

type Props = {
  open: boolean;
  onToggle: (next: boolean) => void;
  onPendingCount?: (n: number) => void;
};

export function DeleteRequestsPanel({ open, onToggle, onPendingCount }: Props) {
  const [requests, setRequests] = useState<DeleteRequestRow[]>([]);
  const [statuses, setStatuses] = useState<string[]>(['pending', 'acknowledged', 'completed', 'rejected']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: string; admin_note: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/delete-requests', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Laden fehlgeschlagen.');
        setRequests([]);
        onPendingCount?.(0);
        return;
      }
      const list = (data.requests ?? []) as DeleteRequestRow[];
      setRequests(list);
      if (Array.isArray(data.statuses) && data.statuses.length) {
        setStatuses(data.statuses as string[]);
      }
      const pending = typeof data.pendingCount === 'number' ? data.pendingCount : 0;
      onPendingCount?.(pending);
      setDrafts(
        list.reduce<Record<string, { status: string; admin_note: string }>>((acc, r) => {
          acc[r.id] = {
            status: r.status,
            admin_note: r.admin_note ?? '',
          };
          return acc;
        }, {})
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.');
      onPendingCount?.(0);
    } finally {
      setLoading(false);
    }
  }, [onPendingCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    setSavingId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/delete-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: d.status, admin_note: d.admin_note.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Speichern fehlgeschlagen.');
      const updated = data.request as DeleteRequestRow | undefined;
      if (updated) {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
        setDrafts((prev) => ({
          ...prev,
          [id]: { status: updated.status, admin_note: updated.admin_note ?? '' },
        }));
      }
      setMessage('Löschanfrage aktualisiert.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSavingId(null);
    }
  };

  const pendingInList = requests.filter((r) => r.status === 'pending').length;
  const titleSuffix = pendingInList > 0 ? ` (${pendingInList} offen)` : '';

  return (
    <CollapsibleSection
      title={`Löschanfragen${titleSuffix}`}
      description="Vom Nutzer beantragte Kontolöschung (Protokoll). Status und interne Notiz pflegen; es erfolgt kein automatisches Löschen."
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

      {loading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Lade Anfragen…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Keine Löschanfragen für Ihren Bereich.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="p-2 font-semibold">Datum</th>
                <th className="p-2 font-semibold">Nutzer</th>
                <th className="p-2 font-semibold">E-Mail</th>
                <th className="p-2 font-semibold">Schule</th>
                <th className="p-2 font-semibold">Status</th>
                <th className="p-2 font-semibold">Notiz (intern)</th>
                <th className="p-2 w-28 font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const draft = drafts[r.id] ?? { status: r.status, admin_note: r.admin_note ?? '' };
                const dirty =
                  draft.status !== r.status || (draft.admin_note ?? '') !== (r.admin_note ?? '');
                return (
                  <tr key={r.id} className="border-b border-zinc-100 align-top dark:border-zinc-800">
                    <td className="p-2 text-xs text-zinc-700 dark:text-zinc-300">
                      {new Date(r.requested_at).toLocaleString('de-DE', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="p-2 text-xs">{r.app_user_label ?? r.app_user_id}</td>
                    <td className="p-2 break-all text-xs">{r.email}</td>
                    <td className="p-2 font-mono text-xs">{r.school_number}</td>
                    <td className="p-2">
                      <select
                        value={draft.status}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...draft, status: e.target.value },
                          }))
                        }
                        className="w-full max-w-[11rem] rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s] ?? s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <textarea
                        value={draft.admin_note}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.id]: { ...draft, admin_note: e.target.value },
                          }))
                        }
                        rows={2}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                        placeholder="Optional"
                      />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        disabled={!dirty || savingId === r.id}
                        onClick={() => void handleSave(r.id)}
                        className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingId === r.id ? '…' : 'Speichern'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleSection>
  );
}
