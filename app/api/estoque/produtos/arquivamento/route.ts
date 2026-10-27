import { prisma } from "@/app/lib/prisma";
import {
  exigirProprietario,
  ErroAutenticacao,
} from "@/app/lib/sessao";

class ErroValidacao extends Error {
  constructor(
    mensagem: string,
    public status = 400,
  ) {
    super(mensagem);
  }
}

function responderErro(error: unknown) {
  if (error instanceof ErroAutenticacao || error instanceof ErroValidacao) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("Erro ao alterar o estado do produto:", error);
  return Response.json(
    { error: "Não foi possível atualizar o produto." },
    { status: 500 },
  );
}

export async function PATCH(request: Request) {
  try {
    await exigirProprietario();

    const dados = await request.json().catch(() => null);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroValidacao("Os dados enviados são inválidos.");
    }

    const idProduto = Number(dados.idProduto);
    if (!Number.isSafeInteger(idProduto) || idProduto <= 0) {
      throw new ErroValidacao("Selecione um produto válido.");
    }
    if (typeof dados.ativo !== "boolean") {
      throw new ErroValidacao("Informe se o produto ficará ativo.");
    }

    const produto = await prisma.$transaction(
      async (tx) => {
        // Os fluxos de movimentação e manejo também bloqueiam esta linha.
        // Assim, saldo e estado são conferidos depois de qualquer operação concorrente.
        await tx.$queryRaw`
          SELECT id_produto
          FROM produto
          WHERE id_produto = ${idProduto}
          FOR UPDATE
        `;

        const atual = await tx.produto.findUnique({
          where: { id_produto: idProduto },
          select: { id_produto: true, ativo: true, quantidade: true },
        });

        if (!atual) {
          throw new ErroValidacao("Produto não encontrado.", 404);
        }

        if (!dados.ativo && Number(atual.quantidade) !== 0) {
          throw new ErroValidacao(
            "Esvazie o saldo do produto antes de arquivá-lo.",
            409,
          );
        }

        if (atual.ativo !== dados.ativo) {
          await tx.produto.update({
            where: { id_produto: idProduto },
            data: { ativo: dados.ativo, atualizado_em: new Date() },
          });
        }

        return { id_produto: idProduto, ativo: dados.ativo };
      },
      { isolationLevel: "ReadCommitted" },
    );

    return Response.json({
      message: produto.ativo
        ? "Produto reativado com sucesso."
        : "Produto arquivado com sucesso.",
      produto,
    });
  } catch (error) {
    return responderErro(error);
  }
}
