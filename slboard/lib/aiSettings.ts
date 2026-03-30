import { supabaseServer } from './supabaseServer';

export type AiSettingsRow = {
  school_number: string;
  max_text_per_doc: number;
  chunk_chars: number;
  chunk_overlap_chars: number;
  max_chunks_per_doc: number;
  debug_log_enabled: boolean;
  updated_at: string;
};

const DEFAULTS = {
  max_text_per_doc: 4500,
  chunk_chars: 2500,
  chunk_overlap_chars: 300,
  max_chunks_per_doc: 3,
  debug_log_enabled: false,
};

export async function getAiSettingsForSchool(schoolNumber: string | null | undefined): Promise<AiSettingsRow> {
  const sn = (schoolNumber ?? '').trim() || '000000';
  const supabase = supabaseServer();
  if (!supabase) {
    return {
      school_number: sn,
      ...DEFAULTS,
      updated_at: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from('ai_settings')
    .select(
      'school_number, max_text_per_doc, chunk_chars, chunk_overlap_chars, max_chunks_per_doc, debug_log_enabled, updated_at'
    )
    .eq('school_number', sn)
    .maybeSingle();

  if (error) {
    return {
      school_number: sn,
      ...DEFAULTS,
      updated_at: new Date().toISOString(),
    };
  }

  if (data) return data as AiSettingsRow;

  // No row yet: create defaults idempotently.
  await supabase
    .from('ai_settings')
    .upsert({ school_number: sn, ...DEFAULTS, updated_at: new Date().toISOString() }, { onConflict: 'school_number' });

  return {
    school_number: sn,
    ...DEFAULTS,
    updated_at: new Date().toISOString(),
  };
}

