'use client';

import React, { useEffect, useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';

type AiForm = {
  max_text_per_doc: number;
  chunk_chars: number;
  chunk_overlap_chars: number;
  max_chunks_per_doc: number;
  llm_timeout_ms: number;
  debug_log_enabled: boolean;
  school_profile_text: string;
};

const DEFAULT_FORM: AiForm = {
  max_text_per_doc: 4500,
  chunk_chars: 2500,
  chunk_overlap_chars: 300,
  max_chunks_per_doc: 3,
  llm_timeout_ms: 45000,
  debug_log_enabled: false,
  school_profile_text: '',
};

type Props = { open: boolean; onToggle: (next: boolean) => void };

export function AiSettingsPanel({ open, onToggle }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AiForm>(DEFAULT_FORM);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/ai-settings', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'KI-Einstellungen konnten nicht geladen werden.');
        const s = data.settings ?? {};
        setForm({
          max_text_per_doc: Number(s.max_text_per_doc) || 4500,
          chunk_chars: Number(s.chunk_chars) || 2500,
          chunk_overlap_chars: Number(s.chunk_overlap_chars) || 300,
          max_chunks_per_doc: Number(s.max_chunks_per_doc) || 3,
          llm_timeout_ms: Number(s.llm_timeout_ms) || 45000,
          debug_log_enabled: Boolean(s.debug_log_enabled),
          school_profile_text: (data.school_profile_text as string | undefined) ?? '',
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'KI-Einstellungen konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'KI-Einstellungen konnten nicht gespeichert werden.');
      setMessage('KI-Konfiguration gespeichert.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Einstellungen konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  };

  const numField = (
    label: string,
    key: keyof Pick<AiForm, 'max_text_per_doc' | 'chunk_chars' | 'chunk_overlap_chars' | 'max_chunks_per_doc' | 'llm_timeout_ms'>
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
      <input
        type="number"
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value) }))}
        className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
    </div>
  );

  return (
    <CollapsibleSection
      title="KI-Einstellungen"
      description="Chunk-Größen, Timeouts und Schul-Steckbrief für KI-Prompts."
      open={open}
      onToggle={onToggle}
    >
      {error && (
        <p className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400">
          {message}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {numField('Max. Zeichen pro Dokument im Prompt', 'max_text_per_doc')}
        {numField('Chunk-Größe (Zeichen)', 'chunk_chars')}
        {numField('Chunk-Overlap (Zeichen)', 'chunk_overlap_chars')}
        {numField('Max. Chunks pro Dokument', 'max_chunks_per_doc')}
        {numField('LLM-Timeout (ms)', 'llm_timeout_ms')}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Schul-Steckbrief (für KI-Kontext)</label>
        <textarea
          value={form.school_profile_text}
          onChange={(e) => setForm((p) => ({ ...p, school_profile_text: e.target.value }))}
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
          checked={form.debug_log_enabled}
          onChange={(e) => setForm((p) => ({ ...p, debug_log_enabled: e.target.checked }))}
          className="rounded"
        />
        Debug-Logging aktivieren (Chunks + Prompts)
      </label>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={loading}
        className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? 'Speichere…' : 'KI-Konfiguration speichern'}
      </button>
    </CollapsibleSection>
  );
}
