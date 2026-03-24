-- Vollständige KI-Antwort und Quellen für Dashboard „Aktuelle Anfragen“ (geräteübergreifend).

alter table if exists public.ai_queries
  add column if not exists answer_text text,
  add column if not exists sources jsonb;

comment on column public.ai_queries.answer_text is 'Vollständige KI-Antwort';
comment on column public.ai_queries.sources is 'JSON-Array: documentId, title, snippet';
