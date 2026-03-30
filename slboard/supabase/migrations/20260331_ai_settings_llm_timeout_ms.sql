-- Clientspezifischer LLM-Timeout (Millisekunden) für KI-Aufrufe

alter table if exists public.ai_settings
  add column if not exists llm_timeout_ms integer not null default 45000;
