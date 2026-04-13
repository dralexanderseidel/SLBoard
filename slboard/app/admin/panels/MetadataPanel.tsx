'use client';

import React, { useEffect, useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import type { DocumentTypeOption, ResponsibleUnitOption } from '../types';

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

  useEffect(() => {
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
  }, []);

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
    setDocTypeOptions((prev) => [...prev, { code, label, active: true, sort_order: prev.length * 10 }]);
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

  const inputClass = 'w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950';

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
          <div className="space-y-2">
            {docTypeOptions.map((t, idx) => (
              <div key={t.code} className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(t.active)} className="rounded" title="Aktiv"
                  onChange={(e) =>
                    setDocTypeOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, active: e.target.checked } : p)))
                  }
                />
                <span className="w-[110px] truncate text-[11px] text-zinc-500" title={t.code}>{t.code}</span>
                <input type="text" value={t.label} placeholder="Label" className={inputClass}
                  onChange={(e) =>
                    setDocTypeOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, label: e.target.value } : p)))
                  }
                />
                <button type="button" onClick={() => setDocTypeOptions((prev) => prev.filter((_, i) => i !== idx))}
                  className="rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  title="Entfernen">
                  Entfernen
                </button>
              </div>
            ))}
            {docTypeOptions.length === 0 && (
              <p className="text-[11px] text-zinc-500">Keine Dokumenttypen gefunden.</p>
            )}
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <input type="text" value={newDocTypeCode} onChange={(e) => setNewDocTypeCode(e.target.value)}
                className={inputClass} placeholder="Code (z. B. PROTOKOLL)" />
              <input type="text" value={newDocTypeLabel} onChange={(e) => setNewDocTypeLabel(e.target.value)}
                className={inputClass} placeholder="Label (z. B. Protokoll)" />
              <button type="button" onClick={addDocType}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">
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
                <input type="checkbox" checked={Boolean(u.active)} className="rounded" title="Aktiv"
                  onChange={(e) =>
                    setResponsibleUnitOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, active: e.target.checked } : p)))
                  }
                />
                <input type="text" value={u.name} placeholder="Name" className={inputClass}
                  onChange={(e) =>
                    setResponsibleUnitOptions((prev) => prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)))
                  }
                />
                <button type="button" onClick={() => setResponsibleUnitOptions((prev) => prev.filter((_, i) => i !== idx))}
                  className="rounded border border-zinc-300 px-2 py-1 text-[11px] hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  title="Entfernen">
                  Entfernen
                </button>
              </div>
            ))}
            <div className="mt-2 flex gap-2">
              <input type="text" value={newRespUnit} onChange={(e) => setNewRespUnit(e.target.value)}
                className={inputClass} placeholder="Neue Verantwortlich-Gruppe hinzufügen" />
              <button type="button" onClick={addRespUnit}
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      </div>

      <button type="button" onClick={() => void handleSave()} disabled={loading}
        className="mt-3 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60">
        {loading ? 'Speichere…' : 'Metadaten speichern'}
      </button>
    </CollapsibleSection>
  );
}
