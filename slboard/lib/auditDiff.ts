/**
 * Vergleich und Delta für Dokument-Audit-Logs (PATCH-Metadaten).
 */
import { docTypeLabelDe } from './documentMeta';

export function auditValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  // Optional Listen: null und [] gelten als gleich
  if (a == null && Array.isArray(b) && b.length === 0) return true;
  if (b == null && Array.isArray(a) && a.length === 0) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => auditValuesEqual(v, b[i]));
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return String(a) === String(b);
    }
  }
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b);
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === b;
  return String(a) === String(b);
}

export function pickDocumentUpdateDelta(
  oldRow: Record<string, unknown> | null,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    const oldVal = oldRow?.[k];
    if (!auditValuesEqual(oldVal, v)) {
      out[k] = v;
    }
  }
  return out;
}


export const AUDIT_METADATA_LABEL_DE: Record<string, string> = {
  gremium: 'Gremium',
  reach_scope: 'Reichweite',
  review_date: 'Evaluation/Wiedervorlage',
  legal_reference: 'Rechtsbezug',
  responsible_unit: 'Zuständige Stelle',
  document_type_code: 'Dokumenttyp',
  protection_class_id: 'Schutzklasse',
  participation_groups: 'Beteiligungsgruppen',
  summary: 'Kurzfassung',
  title: 'Titel',
  status: 'Status',
  archived_at: 'Archiv',
};

const TRUNC = 120;

function truncate(s: string): string {
  const t = s.trim();
  if (t.length <= TRUNC) return t;
  return `${t.slice(0, TRUNC)}…`;
}

function formatIsoDateTime(value: unknown): string {
  if (value == null || value === '') return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return truncate(String(value));
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

/** Anzeigewert für ein Metadatenfeld im Änderungsverlauf (einzelner Wert). */
export function formatAuditScalarDe(fieldKey: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) {
    const v = value.map((x) => String(x).trim()).filter(Boolean);
    return v.length ? truncate(v.join(', ')) : '—';
  }
  if (fieldKey === 'document_type_code') {
    return docTypeLabelDe(String(value).trim());
  }
  if (fieldKey === 'reach_scope') {
    const v = String(value).toLowerCase();
    if (v === 'intern') return 'intern';
    if (v === 'extern') return 'extern';
    return String(value);
  }
  if (fieldKey === 'protection_class_id') {
    return `Schutzklasse ${String(value)}`;
  }
  if (fieldKey === 'review_date') {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      try {
        const [y, m, d] = value.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        return dt.toLocaleDateString('de-DE', { dateStyle: 'medium' });
      } catch {
        return value;
      }
    }
    return String(value);
  }
  if (fieldKey === 'archived_at') {
    return formatIsoDateTime(value);
  }
  if (fieldKey === 'legal_reference' || fieldKey === 'summary' || fieldKey === 'gremium' || fieldKey === 'title') {
    return truncate(String(value));
  }
  return truncate(String(value));
}

export function auditMetadataFieldLabelDe(key: string): string {
  return AUDIT_METADATA_LABEL_DE[key] ?? key;
}
