-- Audit-Log: Wer hat was wann geändert (z. B. Status, Metadaten)
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);

comment on table public.audit_log is 'Protokoll von Änderungen (Dokumente, Status, Metadaten) für Nachvollziehbarkeit.';
