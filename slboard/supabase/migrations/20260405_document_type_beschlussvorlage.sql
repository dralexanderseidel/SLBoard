-- Dokumenttyp: BESCHLUSS → BESCHLUSSVORLAGE (Anzeige: Beschlussvorlage)

insert into public.document_types (code, label, default_protection_class)
values ('BESCHLUSSVORLAGE', 'Beschlussvorlage', 2)
on conflict (code) do update
set
  label = excluded.label,
  default_protection_class = excluded.default_protection_class;

update public.documents
set document_type_code = 'BESCHLUSSVORLAGE'
where document_type_code = 'BESCHLUSS';

insert into public.school_document_type_options (school_number, code, label, sort_order, active)
select
  school_number,
  'BESCHLUSSVORLAGE',
  'Beschlussvorlage',
  sort_order,
  active
from public.school_document_type_options
where code = 'BESCHLUSS'
on conflict (school_number, code) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

delete from public.school_document_type_options where code = 'BESCHLUSS';

delete from public.document_types where code = 'BESCHLUSS';
