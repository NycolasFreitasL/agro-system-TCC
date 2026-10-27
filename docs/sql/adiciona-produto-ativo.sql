-- Alteracao aditiva e revisavel para o arquivamento de produtos.
-- NAO executada. Nao e uma migration Prisma nem parte de prisma/migrations.
-- Alvo esperado pelo schema Prisma e pela documentacao: public.produto.
-- Antes de aplicar, confirme schema, tabela, coluna, privilegios, backup e
-- janela operacional no banco alvo. Interrompa se o catalogo divergir.
-- O DEFAULT TRUE faz produtos existentes e futuras insercoes sem valor
-- explicito ficarem ativos; nenhuma linha ou relacionamento e removido.
--
-- Reexecucao: segura se a coluna estiver ausente ou ja tiver tipo boolean,
-- NOT NULL e default TRUE. Se houver uma coluna ativo divergente, falha
-- explicitamente sem tentar corrigi-la ou sobrescrever dados.

BEGIN;

DO $adiciona_coluna_ativo$
DECLARE
  tipo_relacao "char";
  definicao_valida boolean;
BEGIN
  SELECT c.relkind
    INTO tipo_relacao
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'produto';

  IF tipo_relacao IS NULL THEN
    RAISE EXCEPTION
      'Tabela public.produto nao encontrada. Confirme o schema e o nome reais antes de aplicar.';
  END IF;

  IF tipo_relacao NOT IN ('r', 'p') THEN
    RAISE EXCEPTION
      'public.produto nao e uma tabela comum ou particionada; nenhuma alteracao foi feita.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute AS a
    WHERE a.attrelid = 'public.produto'::regclass
      AND a.attname = 'ativo'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) THEN
    ALTER TABLE public.produto
      ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE;

    RAISE NOTICE
      'Coluna public.produto.ativo criada como BOOLEAN NOT NULL DEFAULT TRUE.';
  ELSE
    SELECT
      a.atttypid = 'boolean'::regtype
      AND a.attnotnull
      AND COALESCE(
        regexp_replace(
          lower(pg_get_expr(d.adbin, d.adrelid)),
          '::boolean|[[:space:]()]',
          '',
          'g'
        ) IN ('true', '''true''', '''t'''),
        false
      )
      INTO definicao_valida
    FROM pg_attribute AS a
    LEFT JOIN pg_attrdef AS d
      ON d.adrelid = a.attrelid
     AND d.adnum = a.attnum
    WHERE a.attrelid = 'public.produto'::regclass
      AND a.attname = 'ativo'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF NOT COALESCE(definicao_valida, false) THEN
      RAISE EXCEPTION
        'public.produto.ativo ja existe, mas nao corresponde a BOOLEAN NOT NULL DEFAULT TRUE. Inspecione manualmente; nenhuma correcao automatica foi tentada.';
    END IF;

    RAISE NOTICE
      'public.produto.ativo ja existe com tipo, obrigatoriedade e default esperados; nenhuma alteracao necessaria.';
  END IF;
END;
$adiciona_coluna_ativo$;

COMMIT;
