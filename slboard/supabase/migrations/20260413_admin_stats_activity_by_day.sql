-- Aggregiert KI-Aktivität nach UTC-Tag für das Admin-Statistik-Dashboard.
-- Ersetzt das Laden von bis zu 20.000 Rohzeilen in die Anwendung.
-- Gibt Einträge nur für Tage zurück, an denen tatsächlich Aktivität stattfand
-- (Tage mit count=0 werden client-seitig aufgefüllt).

CREATE OR REPLACE FUNCTION admin_stats_activity_by_day(
  p_school_number TEXT,
  p_since         TIMESTAMPTZ
)
RETURNS TABLE (
  series TEXT,
  day    TEXT,
  count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'llm_calls' AS series,
    to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
    COUNT(*)::BIGINT AS count
  FROM ai_llm_calls
  WHERE school_number = p_school_number
    AND created_at >= p_since
  GROUP BY 2

  UNION ALL

  SELECT
    'ai_queries' AS series,
    to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
    COUNT(*)::BIGINT AS count
  FROM ai_queries
  WHERE school_number = p_school_number
    AND created_at >= p_since
  GROUP BY 2

  ORDER BY 1, 2;
$$;

-- Zugriff nur für den service_role-Key (wird vom Server-Code genutzt)
REVOKE ALL ON FUNCTION admin_stats_activity_by_day(TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_stats_activity_by_day(TEXT, TIMESTAMPTZ) TO service_role;
