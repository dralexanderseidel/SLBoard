'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import { MIN_APP_PASSWORD_LENGTH } from '../lib/authPasswordConstants';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ChangePasswordDialog({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < MIN_APP_PASSWORD_LENGTH) {
      setError(`Neues Passwort: mindestens ${MIN_APP_PASSWORD_LENGTH} Zeichen.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Die neuen Passwörter stimmen nicht überein.');
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      setError('Keine Sitzung gefunden.');
      return;
    }

    setSaving(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signErr) {
      setSaving(false);
      setError('Aktuelles Passwort ist falsch oder die Sitzung ist abgelaufen.');
      return;
    }

    const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    onClose();
  };

  /** Portal auf document.body: sonst bleibt der Dialog im Header-Stacking-Context (z-40) und liegt unter dem Seiteninhalt. */
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[max(5rem,12svh)] pb-10 sm:pt-[max(6rem,14svh)]"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-labelledby="pwd-dialog-title"
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="pwd-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Passwort ändern
        </h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Geben Sie Ihr aktuelles Passwort und ein neues Passwort ein (min. {MIN_APP_PASSWORD_LENGTH}{' '}
          Zeichen).
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              Aktuelles Passwort
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              Neues Passwort
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              Neues Passwort wiederholen
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Speichern…' : 'Passwort speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
