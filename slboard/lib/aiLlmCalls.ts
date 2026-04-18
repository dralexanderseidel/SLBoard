import type { SupabaseClient } from '@supabase/supabase-js';

/** Pro erfolgreicher LLM-HTTP-Antwort genau ein Eintrag in public.ai_llm_calls. */
export type LlmUseCase =
  | 'qa'
  | 'summary'
  | 'summarize_batch'
  | 'steering'
  | 'todos'
  | 'parent_letter'
  | 'prompt_preview'
  | 'draft';

export type LogLlmCallParams = {
  schoolNumber: string | null | undefined;
  useCase: LlmUseCase;
  metadata?: Record<string, unknown> | null;
};

/**
 * Protokolliert einen physischen LLM-Aufruf (nach erfolgreicher Provider-Antwort).
 * Fehler beim Schreiben werden geschluckt, damit die Nutzeranfrage nicht scheitert.
 */
export async function logLlmCall(supabase: SupabaseClient, params: LogLlmCallParams): Promise<void> {
  const sn = String(params.schoolNumber ?? '').trim();
  if (!/^\d{6}$/.test(sn)) return;
  try {
    const { error } = await supabase.from('ai_llm_calls').insert({
      school_number: sn,
      use_case: params.useCase,
      metadata: params.metadata ?? null,
    });
    if (error) {
      console.error('[ai_llm_calls]', error.message);
    }
  } catch (e) {
    console.error('[ai_llm_calls]', e instanceof Error ? e.message : e);
  }
}
