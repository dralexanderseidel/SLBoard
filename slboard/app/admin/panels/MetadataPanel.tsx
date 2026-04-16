'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import type { DocumentTypeOption, ResponsibleUnitOption } from '../types';
import { METADATA_BROADCAST_CHANNEL } from '../../../lib/metadataBroadcast';

export { METADATA_BROADCAST_CHANNEL };

type Props = { open: boolean; onToggle: (next: boolean) => void };

export function MetadataPanel({ open, onToggle }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [docTypeOptions, setDocTypeOptions] = useState<DocumentTypeOption[]>([]);
  const [responsibleUnitOptions, setResponsibleUnitOptions] = useState<ResponsibleUnitOption[]>([]);
  const [newDocTypeCode, setNewDocTypeCode] = useState('');
  const [newDocTypeLabel, setNewDocTypeLabel] = useState('');
  const [newRespUnit, setNewRespUnit] = useState('');
  const [expandedDraftIdx, setExpandedDraftIdx] = useState<number | null>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!open || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch('/api/admin/metadata', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Metadaten konnten nicht geladen werden.');
        setDocTypeOptions((data.documentTypes ?? []) as DocumentTypeOption[]);
        setResponsibleUnitOptions((data.responsibleUnits ?? []) as ResponsibleUnitOption[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Metadaten konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [open]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentTypes: docTypeOptions, responsibleUnits: responsibleUnitOptions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Metadaten konnten nicht gespeichert werden.');
      setMessage('Metadaten gespeichert.');
      // Andere Tabs/Fenster über Metadaten-Änderung informieren
      try {
        const channel = new BroadcastChannel(METADATA_BROADCAST_CHANNEL);
        channel.postMessage({ type: 'metadata_updated' });
        channel.close();
      } catch { /* BroadcastChannel nicht unterstützt */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Metadaten konnten nicht gespeichert werden.');
    } finally {
      setLoading(false);
    }
  };

  const addDocType = () => {
    const code = newDocTypeCode.trim().toUpperCase();
    const label = newDocTypeLabel.trim();
    if (!code || !label) return;
    if (docTypeOptions.some((x) => x.code.trim().toUpperCase() === code)) return;
    setDocTypeOptions((prev) => [
      ...prev,
      { code, label, active: true, sort_order: prev.length * 10, draft_audience: null, draft_tone: null, draft_format_hint: null },
    ]);
    setNewDocTypeCode('');
    setNewDocTypeLabel('');
  };

  const addRespUnit = () => {
    const v = newRespUnit.trim();
    if (!v) return;
    if (responsibleUnitOptions.some((x) => x.name.trim().toLowerCase() === v.toLowerCase())) return;
    setResponsibleUnitOptions((prev) => [...prev, { name: v, active: true, sort_order: prev.length * 10 }]);
    setNewRespUnit('');
  };

  const updateDocType = (idx: number, patch: Partial<DocumentTypeOption>) => {
    setDocTypeOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const inputClass = 'w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950';
  const draftInputClass = 'w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900';

  return (
    <CollapsibleSection
      title="Metadaten pflegen"
      description="Schulspezifische Listen für Dokumenttypen und verantwortliche Einheiten."
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

      <div className="grid gap-4 md:grid-cols-2">
        {/* Dokumenttypen */}
        <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">Dokumenttypen</p>
          <div className="space-y-1">
            {docTypeOptions.map((t, idx) => (
              <div key={t.code}>
                {/* Hauptzeile */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(t.active)}
                    className="rounded"
                    title="Aktiv"
                    onChange={(e) => updateDocType(idx, { active: e.target.checked })}
                  />
                  <span className="w-[110px] shrink-0 truncate text-[11px] text-zinc-500" title={t.code}>{t.code}</span>
                  <input
                    type="text"
                    value={t.label}
                    placeholder="Label"
                    className={inputClass}
                    onChange={(e) => updateDocType(idx, { label: e.target.value })}
                  />
                  <button
                    type="button"
                    title="KI-Entwurfs-Einstellungen"
                    onClick={() => setExpandedDraftIdx(expandedDraftIdx === idx ? null : idx)}
                    className={`shrink-0 rounded border px-2 py-1 text-[11px] transition ${
                      expandedDraftIdx === idx
                        ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-300'
                        : 'border-zinc-300 text-zinc-500 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-400'
                    }`}
                  >
                    KI ▾
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDocTypeOptions((prev) => prev.filter((_, i) => i !== idx));
                      if (expandedDraftIdx === idx) setExpandedDraftIdx(null);
                      else if (expandedDraftIdx !== null && expandedDraftIdx > idx) setExpandedDraftIdx(expandedDraftIdx - 1);
                    }}
                    className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    title="Entfernen"
                  >
                    Entfernen
                  </button>
                </div>

                {/* Entwurfs-Einstellungen (expandierbar) */}
                {expandedDraftIdx === idx && (
                  <div className="ml-[118px] mt-1.5 rounded border border-blue-100 bg-blue-50/50 p-2.5 dark:border-blue-900/30 dark:bg-blue-950/20">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                      KI-Entwurfs-Einstellungen
                    </p>
                    <div className="space-y-2">
                      <div>
                        <label className="mb-0.5 block text-[11px] text-zinc-600 dark:text-zinc-400">
                          Zielgruppe <span className="text-zinc-400">(Standard für Entwurfsassistent)</span>
                        </label>
                        <input
                          type="text"
                          value={t.draft_audience ?? ''}
                          placeholder="z. B. Eltern der Schulgemeinschaft"
                          className={draftInputClass}
                          onChange={(e) => updateDocType(idx, { draft_audience: e.target.value || null })}
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-zinc-600 dark:text-zinc-400">
                          Schreibstil / Ton
                        </label>
                        <input
                          type="text"
                          value={t.draft_tone ?? ''}
                          placeholder="z. B. sachlichem, freundlichem"
                          className={draftInputClass}
                          onChange={(e) => updateDocType(idx, { draft_tone: e.target.value || null })}
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] text-zinc-600 dark:text-zinc-400">
                          Format-Anweisung für KI
                        </label>
                        <textarea
                          value={t.draft_format_hint ?? ''}
                          placeholder="z. B. Mit Anrede und Grußformel."
                          className={`${draftInputClass} resize-y`}
                          rows={2}
                          onChange={(e) => updateDocType(idx, { draft_format_hint: e.target.value || null })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {docTypeOptions.length === 0 && (
              <p className="text-[11px] text-zinc-500">Keine Dokumenttypen gefunden.</p>
            )}
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <input
                type="text"
                value={newDocTypeCode}
                onChange={(e) => setNewDocTypeCode(e.target.value)}
                className={inputClass}
                placeholder="Code (z. B. PROTOKOLL)"
              />
              <input
                type="text"
                value={newDocTypeLabel}
                onChange={(e) => setNewDocTypeLabel(e.target.value)}
                className={inputClass}
                placeholder="Label (z. B. Protokoll)"
              />
              <button
                type="button"
                onClick={addDocType}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>

        {/* Verantwortlich */}
        <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">Verantwortlich</p>
          <div className="space-y-2">
            {responsibleUnitOptions.map((u, idx) => (
              <div key={u.name} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(u.active)}
                  className="rounded"
                  title="Aktiv"
                  onChange={(e) =>
                    setResponsibleUnitOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, active: e.target.checked } : p)))
                  }
                />
                <input
                  type="text"
                  value={u.name}
                  placeholder="Name"
                  className={inputClass}
                  onChange={(e) =>
                    setResponsibleUnitOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)))
                  }
                />
                <button
                  type="button"
                  onClick={() => setResponsibleUnitOptions((prev) => prev.filter((_, i) => i !== idx))}
                  className="rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  title="Entfernen"
                >
                  Entfernen
                </button>
              </div>
            ))}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newRespUnit}
                onChange={(e) => setNewRespUnit(e.target.value)}
                className={inputClass}
                placeholder="Neue Verantwortlich-Gruppe hinzufügen"
              />
              <button
                type="button"
                onClick={addRespUnit}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={loading}
        className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? 'Speichere…' : 'Metadaten speichern'}
      </button>
    </CollapsibleSection>
  );
}
