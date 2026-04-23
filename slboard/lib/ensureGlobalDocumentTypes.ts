import type { SupabaseClient } from '@supabase/supabase-js';

export type GlobalDocumentTypeEnsureEntry = { code: string; label: string };

function isUniqueViolation(err: { code?: string; message?: string }): boolean {
  return err.code === '23505' || (err.message?.toLowerCase().includes('duplicate') ?? false);
}

/**
 * Legt in `document_types` fehlende Zeilen an (`documents.document_type_code` FK).
 * Bestehende Codes werden nicht überschrieben (u. a. `default_protection_class` der Seeds).
 */
export async function ensureGlobalDocumentTypeRows(
  supabase: SupabaseClient,
  entries: GlobalDocumentTypeEnsureEntry[],
): Promise<{ error: string | null }> {
  const dedup = new Map<string, { code: string; label: string }>();
  for (const e of entries) {
    const code = (e.code ?? '').trim();
    if (!code) continue;
    const label = ((e.label ?? '').trim() || code).slice(0, 500);
    dedup.set(code, { code, label });
  }
  if (dedup.size === 0) return { error: null };

  const codes = [...dedup.keys()];
  const { data: existingRows, error: selErr } = await supabase.from('document_types').select('code').in('code', codes);
  if (selErr) return { error: selErr.message };

  const existing = new Set((existingRows ?? []).map((r) => String((r as { code: string }).code)));
  const toInsert = [...dedup.values()].filter((row) => !existing.has(row.code));

  for (const row of toInsert) {
    const { error } = await supabase.from('document_types').insert({
      code: row.code,
      label: row.label,
      default_protection_class: 1,
    });
    if (error && !isUniqueViolation(error)) {
      return { error: error.message };
    }
  }
  return { error: null };
}
