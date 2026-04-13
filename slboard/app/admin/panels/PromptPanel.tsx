'use client';

import React, { useEffect, useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import type { PromptTemplateConfig, PromptUseCase } from '../types';

type Props = { open: boolean; onToggle: (next: boolean) => void };

const USE_CASE_LABELS: Record<PromptUseCase, string> = {
  qa: 'Q&A',
  summary: 'Zusammenfassung',
  steering: 'Steuerungsanalyse',
};

export function PromptPanel({ open, onToggle }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PromptTemplateConfig[]>([]);
  const [activeUseCase, setActiveUseCase] = useState<PromptUseCase>('steering');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch('/api/admin/ai-prompts', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'KI-Prompts konnten nicht geladen werden.');
        setTemplates((data.templates ?? []) as PromptTemplateConfig[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'KI-Prompts konnten nicht geladen werden.');
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
      const payload = {
        templates: templates.map((t) => ({
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
      setTemplates((data.templates ?? []) as PromptTemplateConfig[]);
      setMessage('KI-Prompts gespeichert.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'KI-Prompts konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (mode: 'prompt_only' | 'llm_test') => {
    setPreviewLoading(true);
    setError(null);
    setMessage(null);
    setPreviewResult(null);
    try {
      const res = await fetch('/api/admin/ai-prompts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_case: activeUseCase, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Prompt-Preview fehlgeschlagen.');
      const showSteeringFormat = activeUseCase === 'steering' && (data.mode ?? mode) === 'llm_test';
      const formatInfo = showSteeringFormat ? ` · JSON-Format ok: ${data.steeringFormatOk ? 'ja' : 'nein'}` : '';
      const errorInfo =
        showSteeringFormat && Array.isArray(data.steeringFormatErrors) && data.steeringFormatErrors.length > 0
          ? `\nFehler:\n- ${(data.steeringFormatErrors as string[]).join('\n- ')}`
          : '';
      setPreviewResult(
        `Use Case: ${data.use_case} · Modus: ${data.mode ?? mode}${formatInfo}${errorInfo}\n\n` +
        `--- Prompt-Ausgabe (gekürzt) ---\n${(data.outputPreview as string | undefined) ?? 'Keine Ausgabe (nur Vorschau.)'}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prompt-Preview fehlgeschlagen.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleReset = async () => {
    const ok = window.confirm(`Prompt-Bausteine fuer "${activeUseCase}" auf Schul-Default zuruecksetzen?`);
    if (!ok) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/ai-prompts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_case: activeUseCase }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Reset fehlgeschlagen.');
      setTemplates((data.templates ?? []) as PromptTemplateConfig[]);
      setMessage(`Prompt-Bausteine fuer "${activeUseCase}" auf Default zurueckgesetzt.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const current = templates.find((t) => t.use_case === activeUseCase);
  const textareaReadonly = 'w-full rounded border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  const textareaEdit = 'w-full rounded border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950';

  return (
    <CollapsibleSection
      title="KI-Prompts"
      description="Schulspezifische Prompt-Bausteine mit gesperrtem Antwortformat."
      open={open}
      onToggle={onToggle}
    >
      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
        Bearbeitbar sind nur die Zusatzbausteine. Das Antwortformat (z. B. JSON fuer Steuerungsanalyse)
        bleibt im gesperrten Block unveraendert.
      </p>

      {error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-2 rounded border border-green-200 bg-green-50 px-2 py-1 text-[11px] text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          {message}
        </p>
      )}

      {/* Use-Case-Tabs */}
      <div className="mt-3 flex flex-wrap gap-2">
        {(['qa', 'summary', 'steering'] as PromptUseCase[]).map((uc) => (
          <button
            key={uc}
            type="button"
            onClick={() => setActiveUseCase(uc)}
            className={`rounded border px-2 py-1 text-[11px] ${
              activeUseCase === uc
                ? 'border-blue-300 bg-blue-50 text-zinc-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-zinc-50'
                : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'
            }`}
          >
            {USE_CASE_LABELS[uc]}
          </button>
        ))}
      </div>

      {/* Template-Editor */}
      {loading && templates.length === 0 ? (
        <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">Lade Prompt-Templates…</p>
      ) : !current ? (
        <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">Kein Template gefunden.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Gesperrter System-Block (readonly)</label>
            <textarea readOnly value={current.system_locked} rows={6} className={textareaReadonly} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Editierbarer System-Zusatz</label>
            <textarea
              value={current.system_editable}
              rows={4}
              onChange={(e) =>
                setTemplates((prev) =>
                  prev.map((t) => t.use_case === current.use_case ? { ...t, system_editable: e.target.value } : t)
                )
              }
              className={textareaEdit}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Gesperrter User-Block (readonly)</label>
            <textarea readOnly value={current.user_locked} rows={8} className={`${textareaReadonly} font-mono`} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Editierbarer User-Zusatz</label>
            <textarea
              value={current.user_editable}
              rows={4}
              onChange={(e) =>
                setTemplates((prev) =>
                  prev.map((t) => t.use_case === current.use_case ? { ...t, user_editable: e.target.value } : t)
                )
              }
              className={textareaEdit}
            />
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Version: {current.version}
            {current.updated_at ? ` · Aktualisiert: ${new Date(current.updated_at).toLocaleString('de-DE')}` : ''}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleSave()}
          disabled={loading || templates.length === 0}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'Speichere Prompt-Bausteine…' : 'Prompt-Bausteine speichern'}
        </button>
        <button type="button" onClick={() => void handlePreview('prompt_only')}
          disabled={previewLoading || templates.length === 0}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
          {previewLoading ? 'Lade Vorschau…' : 'Prompt-Vorschau (ohne LLM)'}
        </button>
        <button type="button" onClick={() => void handlePreview('llm_test')}
          disabled={previewLoading || templates.length === 0}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
          {previewLoading ? 'Teste Prompt…' : 'Prompt testen (LLM)'}
        </button>
        <button type="button" onClick={() => void handleReset()}
          disabled={loading || templates.length === 0}
          className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950">
          Auf Default zuruecksetzen
        </button>
      </div>

      {previewResult && (
        <pre className="mt-3 max-h-64 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
          {previewResult}
        </pre>
      )}
    </CollapsibleSection>
  );
}
