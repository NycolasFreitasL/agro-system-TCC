-- Proposta de inspeção SOMENTE LEITURA. Não executada nesta etapa.
SELECT current_schema(), current_setting('search_path'),
       current_setting('default_transaction_isolation');

SELECT n.nspname AS schema, c.relname AS tabela, co.conname,
       co.contype, pg_get_constraintdef(co.oid) AS definicao
FROM pg_constraint co
JOIN pg_class c ON c.oid = co.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN ('plantio', 'lote', 'colheita', 'produto', 'cultura', 'usuarios', 'evento_plantio')
ORDER BY n.nspname, c.relname, co.conname;

SELECT table_schema, table_name, column_name, data_type, is_nullable,
       character_maximum_length, numeric_precision, numeric_scale, column_default
FROM information_schema.columns
WHERE table_name IN ('plantio', 'lote', 'colheita', 'produto', 'cultura', 'usuarios', 'evento_plantio')
ORDER BY table_schema, table_name, ordinal_position;

SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes
WHERE tablename IN ('plantio', 'lote', 'colheita', 'produto', 'cultura', 'usuarios', 'evento_plantio');

SELECT n.nspname AS schema, c.relname AS tabela, t.tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND c.relname IN ('plantio', 'lote', 'colheita', 'produto', 'cultura', 'usuarios', 'evento_plantio');

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('plantio', 'lote', 'colheita', 'produto', 'cultura', 'usuarios', 'evento_plantio');

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('plantio', 'lote', 'colheita', 'produto', 'cultura', 'usuarios', 'evento_plantio');

SELECT
  COUNT(*) FILTER (
    WHERE status_plantio IN ('ATIVO', 'EM ANDAMENTO')
      AND area_plantada IS NULL
  ) AS ativos_sem_area,

  COUNT(*) FILTER (
    WHERE status_plantio IN ('ATIVO', 'EM ANDAMENTO')
      AND id_cultura IS NULL
  ) AS ativos_sem_cultura,

  COUNT(*) FILTER (
    WHERE status_plantio IN ('CONCLUIDO', 'CONCLUÍDO')
      AND (area_plantada IS NULL OR id_cultura IS NULL)
  ) AS concluidos_incompletos
FROM plantio;

SELECT COUNT(*) AS lotes_com_varios_plantios_sem_area
FROM (
  SELECT id_lote
  FROM plantio
  WHERE status_plantio IN ('ATIVO', 'EM ANDAMENTO')
    AND area_plantada IS NULL
  GROUP BY id_lote
  HAVING COUNT(*) > 1
) AS lotes;