-- Fehlende Einträge in der per user_roles_role_code_fkey referenzierten Lookup-Tabelle.
-- Ohne diese Zeilen schlagen INSERTs für z. B. VERWALTUNG / KOORDINATION fehl.

DO $$
DECLARE
  ref_ns text;
  ref_rel text;
  ref_col text;
  vals text[] := ARRAY[
    'SCHULLEITUNG',
    'SEKRETARIAT',
    'VERWALTUNG',
    'KOORDINATION',
    'LEHRKRAFT',
    'FACHVORSITZ',
    'STEUERGRUPPE',
    'ADMIN',
    'SUPER_ADMIN'
  ];
  v text;
BEGIN
  SELECT
    n.nspname,
    c.relname,
    a.attname
  INTO ref_ns, ref_rel, ref_col
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.confrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = con.confkey[1]
  WHERE con.conname = 'user_roles_role_code_fkey'
    AND con.contype = 'f';

  IF ref_ns IS NULL THEN
    RAISE NOTICE 'user_roles_role_code_fkey nicht gefunden; Rollen-Seed übersprungen.';
    RETURN;
  END IF;

  FOREACH v IN ARRAY vals
  LOOP
    EXECUTE format(
      'INSERT INTO %I.%I (%I) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM %I.%I t WHERE t.%I = $1)',
      ref_ns,
      ref_rel,
      ref_col,
      ref_ns,
      ref_rel,
      ref_col
    )
    USING v;
  END LOOP;
END $$;
