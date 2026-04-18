/**
 * Quota-Prüfungen für Upload, Nutzeranlage und KI-Anfragen.
 * Gibt null zurück wenn alles ok, sonst ein Fehlerobjekt { code, message }.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type QuotaError = { code: string; message: string };

/** Prüft ob die monatliche KI-Anfragen-Quota der Schule noch nicht erreicht ist.
 *  Zählt ai_llm_calls im laufenden Kalendermonat (UTC). */
export async function checkAiQuota(
  supabase: SupabaseClient,
  schoolNumber: string
): Promise<QuotaError | null> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [schoolRes, countRes] = await Promise.all([
    supabase
      .from('schools')
      .select('quota_max_ai_queries_per_month')
      .eq('school_number', schoolNumber)
      .single(),
    supabase
      .from('ai_llm_calls')
      .select('id', { count: 'exact', head: true })
      .eq('school_number', schoolNumber)
      .gte('created_at', monthStart.toISOString()),
  ]);

  const quota =
    (schoolRes.data as { quota_max_ai_queries_per_month?: number | null } | null)
      ?.quota_max_ai_queries_per_month ?? null;

  if (quota === null) return null;

  const used = countRes.count ?? 0;
  if (used >= quota) {
    return {
      code: 'QUOTA_EXCEEDED',
      message: `KI-Anfragen-Quota für diesen Monat erreicht (${used} / ${quota}). Bitte wenden Sie sich an Ihren Administrator.`,
    };
  }
  return null;
}
