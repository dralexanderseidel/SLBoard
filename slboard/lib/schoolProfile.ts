import { supabaseServer } from './supabaseServer';

export async function getSchoolProfileText(schoolNumber: string | null | undefined): Promise<string> {
  const sn = (schoolNumber ?? '').trim();
  if (!sn) return '';
  const supabase = supabaseServer();
  if (!supabase) return '';
  const { data } = await supabase
    .from('schools')
    .select('profile_text')
    .eq('school_number', sn)
    .maybeSingle();
  return ((data as { profile_text?: string | null } | null)?.profile_text ?? '').trim();
}

