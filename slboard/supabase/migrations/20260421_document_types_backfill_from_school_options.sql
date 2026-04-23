-- Fehlende globale Dokumenttypen aus Schul-Optionen nachziehen (FK documents.document_type_code -> document_types.code).
insert into public.document_types (code, label, default_protection_class)
select s.code, s.label, 1
from (
  select distinct on (o.code)
    o.code,
    left(trim(o.label), 500) as label
  from public.school_document_type_options o
  where length(trim(o.code)) > 0
  order by o.code, o.updated_at desc nulls last
) s
where not exists (select 1 from public.document_types dt where dt.code = s.code);
