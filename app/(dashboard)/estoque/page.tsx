import { prisma } from "@/app/lib/prisma";
import EstoquePainel from "@/app/components/estoque-painel";

export default async function EstoquePage() {
  const [produtos, movimentacoes, contagemHoje] =
    await Promise.all([
      prisma.produto.findMany({
        include: {
          cultura: {
            select: {
              nome_cultura: true,
            },
          },
        },
        orderBy: {
          nome_produto: "asc",
        },
      }),

      prisma.move_estoque.findMany({
        take: 10,
        orderBy: [
          {
            data_movimentacao: "desc",
          },
          {
            id_movimentacao: "desc",
          },
        ],
        include: {
          produto: true,
          usuarios: true,
        },
      }),

      prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*) AS total
        FROM move_estoque
        WHERE
          (data_movimentacao AT TIME ZONE 'America/Sao_Paulo')::date
          =
          (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
      `,
    ]);

  return (
    <EstoquePainel
      produtos={produtos.map((produto) => ({
        id_produto: produto.id_produto,
        nome_produto: produto.nome_produto,
        categoria: produto.categoria,
        quantidade: Number(produto.quantidade),
        estoque_min: Number(produto.estoque_min),
        unidade_medida: produto.unidade_medida,
        id_cultura: produto.id_cultura,
        culturaNome: produto.cultura?.nome_cultura ?? null,
      }))}
      movimentacoes={movimentacoes.map((movimento) => ({
        id: movimento.id_movimentacao,
        produto: movimento.produto.nome_produto,
        tipo: movimento.tipo_movimento,
        quantidade: Number(movimento.quantidade_move),
        unidade: movimento.produto.unidade_medida,
        data: movimento.data_movimentacao.toISOString(),
        responsavel: movimento.usuarios.nome_usuario,
        observacao: movimento.observacao,
      }))}
      movimentacoesHoje={Number(contagemHoje[0]?.total ?? 0)}
    />
  );
}