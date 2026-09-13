import { prisma } from "@/app/lib/prisma";

export async function POST(request: Request) {
  try {
    const dados = await request.json();

    const idProduto = Number(dados.idProduto);
    const quantidade = Number(dados.quantidade);
    const tipo = dados.tipo;

    if (
      !Number.isInteger(idProduto) ||
      idProduto <= 0
    ) {
      return Response.json(
        {
          error: "Produto inválido.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isFinite(quantidade) ||
      quantidade <= 0
    ) {
      return Response.json(
        {
          error:
            "Informe uma quantidade maior que zero.",
        },
        {
          status: 400,
        },
      );
    }

    if (tipo !== "ENTRADA" && tipo !== "SAIDA") {
      return Response.json(
        {
          error: "Tipo de movimentação inválido.",
        },
        {
          status: 400,
        },
      );
    }

    const resultado = await prisma.$transaction(
      async (transaction) => {
        const produto =
          await transaction.produto.findUnique({
            where: {
              id_produto: idProduto,
            },
          });

        if (!produto) {
          throw new Error("PRODUTO_NAO_ENCONTRADO");
        }

        const usuario =
          await transaction.usuarios.findFirst({
            orderBy: {
              id_usuario: "asc",
            },
          });

        if (!usuario) {
          throw new Error("USUARIO_NAO_ENCONTRADO");
        }

        const saldoAtual = Number(
          produto.quantidade,
        );

        if (
          tipo === "SAIDA" &&
          quantidade > saldoAtual
        ) {
          throw new Error("ESTOQUE_INSUFICIENTE");
        }

        const produtoAtualizado =
          await transaction.produto.update({
            where: {
              id_produto: idProduto,
            },

            data: {
              quantidade:
                tipo === "ENTRADA"
                  ? {
                      increment: quantidade,
                    }
                  : {
                      decrement: quantidade,
                    },
            },
          });

        await transaction.move_estoque.create({
          data: {
            id_produto: idProduto,
            tipo_movimento: tipo,
            quantidade_move:
              quantidade.toString(),

            observacao:
              typeof dados.observacao === "string" &&
              dados.observacao.trim()
                ? dados.observacao.trim()
                : null,

            id_usuario: usuario.id_usuario,
          },
        });

        return produtoAtualizado;
      },
    );

    return Response.json({
      message:
        "Movimentação registrada com sucesso.",
      produto: resultado,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ESTOQUE_INSUFICIENTE"
    ) {
      return Response.json(
        {
          error:
            "A quantidade de saída é maior que o estoque disponível.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "PRODUTO_NAO_ENCONTRADO"
    ) {
      return Response.json(
        {
          error: "Produto não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      error instanceof Error &&
      error.message === "USUARIO_NAO_ENCONTRADO"
    ) {
      return Response.json(
        {
          error:
            "Cadastre pelo menos um usuário antes de movimentar o estoque.",
        },
        {
          status: 400,
        },
      );
    }

    console.error(
      "Erro ao movimentar estoque:",
      error,
    );

    return Response.json(
      {
        error:
          "Não foi possível registrar a movimentação.",
      },
      {
        status: 500,
      },
    );
  }
}