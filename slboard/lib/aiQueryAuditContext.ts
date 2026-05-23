/**
 * Liest document.update-Einträge aus audit_log für KI-QA (Workflow-/Statushistorie).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { statusLabelDe } from './documentWorkflow';

export type DocumentAuditRow = {
  entity_id: string;
  user_email: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
};

const MAX_FETCH_ROWS = 500;

/** Nach Filter auf Statusänderungen: höchstens so viele Zeilen pro Dokument (neueste zuletzt im Block). */
const MAX_STATUS_LINES_PER_DOCUMENT = 40;

const WORKFLOW_AUDIT_HEAD = [
  'Änderungsverlauf (Workflow-Status, aus Protokoll):',
  'Nutze diese Zeilen für Fragen zu Zeitpunkt oder Reihenfolge von Statuswechseln („wann beschlossen“, „wann veröffentlicht“ usw.).',
].join('\n');

/** Wenn für ein Dokument keine passenden audit_log-Zeilen geladen wurden. */
export function emptyWorkflowAuditPromptSection(): string {
  return `${WORKFLOW_AUDIT_HEAD}\n(Keine protokollierten Statuswechsel vorhanden.)`;
}

/** Lädt Audit-Zeilen für mehrere Dokument-IDs (eine Schulnummer wie RLS-/API-Zugriff). */
export async function fetchDocumentAuditLogsForAiQuery(
  supabase: SupabaseClient,
  options: {
    documentIds: string[];
    schoolNumber: string | null;
  },
): Promise<DocumentAuditRow[]> {
  const ids = [...new Set(options.documentIds.filter(Boolean))];
  if (ids.length === 0) return [];

  let q = supabase
    .from('audit_log')
    .select('entity_id, user_email, action, old_values, new_values, created_at')
    .eq('entity_type', 'document')
    .in('entity_id', ids)
    .eq('action', 'document.update')
    .order('created_at', { ascending: false })
    .limit(MAX_FETCH_ROWS);

  const sn = options.schoolNumber?.trim();
  if (sn) {
    q = q.eq('school_number', sn);
  }

  const { data, error } = await q;
  if (error || !data) {
    return [];
  }

  return (data as DocumentAuditRow[]).filter((row) => row.entity_id && isStatusChangingUpdate(row));
}

function isStatusChangingUpdate(row: DocumentAuditRow): boolean {
  const nv = row.new_values;
  if (!nv || typeof nv !== 'object') return false;
  return 'status' in nv && nv.status !== undefined;
}

/** Gruppiert nach Dokument-ID, je Dokument chronologisch aufsteigend, gekappt. */
export function formatWorkflowAuditSectionsByDocument(rows: DocumentAuditRow[]): Map<string, string> {
  const byDoc = new Map<string, DocumentAuditRow[]>();
  for (const row of rows) {
    const id = row.entity_id;
    const list = byDoc.get(id) ?? [];
    list.push(row);
    byDoc.set(id, list);
  }

  const out = new Map<string, string>();
  for (const [docId, list] of byDoc) {
    const sortedAsc = [...list].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return ta - tb;
    });

    let slice = sortedAsc;
    if (sortedAsc.length > MAX_STATUS_LINES_PER_DOCUMENT) {
      slice = sortedAsc.slice(-MAX_STATUS_LINES_PER_DOCUMENT);
    }

    const tail: string[] = [];

    if (sortedAsc.length > MAX_STATUS_LINES_PER_DOCUMENT) {
      tail.push(
        `(Ältere Einträge aus Platzgründen gekürzt; angezeigt: die letzten ${MAX_STATUS_LINES_PER_DOCUMENT} Statusänderungen.)`,
      );
    }

    for (const row of slice) {
      tail.push(formatStatusAuditLine(row));
    }

    out.set(docId, `${WORKFLOW_AUDIT_HEAD}\n${tail.join('\n')}`);
  }

  return out;
}

function formatStatusAuditLine(row: DocumentAuditRow): string {
  let dateStr = row.created_at;
  try {
    const d = new Date(row.created_at);
    if (!Number.isNaN(d.getTime())) {
      dateStr = d.toLocaleString('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    }
  } catch {
    /* keep raw */
  }

  const nv = row.new_values ?? {};
  const ov = row.old_values ?? {};
  const rawNew = nv['status'];
  const rawOld = ov['status'];
  const newCode =
    rawNew !== undefined && rawNew !== null ? String(rawNew).trim() : '';
  const oldCodeKnown = rawOld !== undefined && rawOld !== null && String(rawOld).trim().length > 0;
  const oldCode = oldCodeKnown ? String(rawOld).trim() : '';

  const fromLabel = oldCode ? statusLabelDe(oldCode) : '(vorher nicht protokolliert)';
  const toLabel = newCode ? statusLabelDe(newCode) : '—';
  const codeHint =
    oldCode && newCode && oldCode !== newCode ? ` [${oldCode}→${newCode}]` : '';

  const actor = row.user_email?.trim() || '—';
  return `- ${dateStr} · ${actor} · ${fromLabel} → ${toLabel}${codeHint}`;
}
