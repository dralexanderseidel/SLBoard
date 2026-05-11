'use client';

import React, { useMemo, useState } from 'react';
import { normalizeAuthEmail } from '@/lib/authEmail';
import { DOCUMENT_COMMENT_BODY_MAX_CHARS } from '@/lib/documentCommentsConstants';
import type { DocumentComment } from './types';

type Props = {
  documentId: string;
  userEmail: string | null;
  comments: DocumentComment[];
  onRefresh: () => void;
};

function authorDisplay(c: DocumentComment) {
  const label = (c.authorLabel ?? '').trim();
  if (label) return label;
  return c.authorEmail || 'Unbekannt';
}

export function DocumentCommentsPanel({ documentId, userEmail, comments, onRefresh }: Props) {
  const [newBody, setNewBody] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const normUser = userEmail ? normalizeAuthEmail(userEmail) : '';

  const canManage = (c: DocumentComment) =>
    Boolean(normUser) && normalizeAuthEmail(c.authorEmail) === normUser;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const trimmed = newBody.trim();
    if (!trimmed) {
      setSubmitError('Bitte Text eingeben.');
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = 'Kommentar konnte nicht gespeichert werden.';
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        setSubmitError(msg);
        return;
      }
      setNewBody('');
      onRefresh();
    } catch {
      setSubmitError('Netzwerkfehler.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const saveEdit = async (commentId: string) => {
    setActionLoading(commentId);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments/${commentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editDraft }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = 'Speichern fehlgeschlagen.';
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        setSubmitError(msg);
        return;
      }
      cancelEdit();
      onRefresh();
    } catch {
      setSubmitError('Netzwerkfehler.');
    } finally {
      setActionLoading(null);
    }
  };

  const softDelete = async (commentId: string) => {
    if (!window.confirm('Diesen Kommentar entfernen? Er verschwindet für alle Betrachter.')) return;
    setActionLoading(commentId);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments/${commentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delete: true }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = 'Löschen fehlgeschlagen.';
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        setSubmitError(msg);
        return;
      }
      onRefresh();
    } catch {
      setSubmitError('Netzwerkfehler.');
    } finally {
      setActionLoading(null);
    }
  };

  const sorted = useMemo(
    () => [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [comments],
  );

  return (
    <div className="mt-4 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
      <h3 className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">Kommentare</h3>
      <p className="mb-2 text-[10px] text-zinc-500 dark:text-zinc-400">
        Sichtbar für alle mit Leserecht auf dieses Dokument. Nur der Autor kann einen Kommentar bearbeiten oder
        entfernen (Entfernen blendet den Eintrag für alle aus).
      </p>

      {submitError && <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{submitError}</p>}

      <form onSubmit={(e) => void handleSubmit(e)} className="mb-3 space-y-2">
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={3}
          maxLength={DOCUMENT_COMMENT_BODY_MAX_CHARS}
          placeholder="Kommentar schreiben…"
          className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-800 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-zinc-400">
            {newBody.length}/{DOCUMENT_COMMENT_BODY_MAX_CHARS}
          </span>
          <button
            type="submit"
            disabled={submitLoading || !newBody.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitLoading ? '…' : 'Kommentar hinzufügen'}
          </button>
        </div>
      </form>

      {sorted.length === 0 ? (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Noch keine Kommentare.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((c) => {
            const mine = canManage(c);
            const busy = actionLoading === c.id;
            return (
              <li
                key={c.id}
                className="rounded border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">{authorDisplay(c)}</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {new Date(c.createdAt).toLocaleString('de-DE')}
                    {c.updatedAt !== c.createdAt ? ' · bearbeitet' : ''}
                  </p>
                </div>
                {editingId === c.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      maxLength={DOCUMENT_COMMENT_BODY_MAX_CHARS}
                      className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-[11px] dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveEdit(c.id)}
                        className="rounded bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Speichern
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={cancelEdit}
                        className="rounded border border-zinc-300 px-2 py-1 text-[10px] dark:border-zinc-600"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-[11px] leading-snug text-zinc-700 dark:text-zinc-300">
                    {c.body}
                  </p>
                )}
                {mine && editingId !== c.id ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(c.id);
                        setEditDraft(c.body);
                      }}
                      className="text-[10px] font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void softDelete(c.id)}
                      className="text-[10px] font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                    >
                      Entfernen
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
