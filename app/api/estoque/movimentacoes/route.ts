import { prisma } from "@/app/lib/prisma";
import {
  exigirUsuario,
  ErroAutenticacao,
} from "@/app/lib/sessao";

const MAXIMO_CENTESIMOS = 9999999999;

class ErroValidacao extends Error {
  constructor(
    mensagem: string,
    public status = 400,
  ) {
    super(mensagem);
  }
}

function decimal(centesimos: number) {
  const inteiro = Math.floor(centesimos / 100);
  const fracao = String(centesimos % 100).padStart(2, "0");

  return `${inteiro}.${fracao}`;
}

function lerId(valor: unknown) {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao("Produto inválido.");
  }

  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ErroValidacao("Produto inválido.");
  }

  return id;
}

function lerQuantidade(valor: unknown) {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao(
      "Informe a quantidade da movimentação.",
    );
  }

  const texto = String(valor).trim();

  if (!/^\d{1,8}(\.\d{1,2})?$/.test(texto)) {
    throw new ErroValidacao(
      "Informe uma quantidade com até duas casas decimais e no máximo 99.999.999,99.",
    );
  }

  const [inteiro, fracao = ""] = texto.split(".");

  const centesimos =
    Number(inteiro) * 100 +
    Number(fracao.padEnd(2, "0"));

  if (
    !Number.isSafeInteger(centesimos) ||
    centesimos <= 0 ||
    centesimos > MAXIMO_CENTESIMOS
  ) {
    throw new ErroValidacao(
      "Informe uma quantidade maior que zero e dentro do limite permitido.",
    );
  }

  return centesimos;
}

export async function POST(request: Request) {
  try {
    const usuario = await exigirUsuario();

    const dados = await request.json().catch(() => {
      throw new ErroValidacao(
        "Os dados enviados são inválidos.",
      );
    });

    if (
      !dados ||
      typeof dados !== "object" ||
      Array.isArray(dados)
    ) {
      throw new ErroValidacao(
        "Os dados enviados são inválidos.",
      );
    }

    const idProduto = lerId(dados.idProduto);
    const centesimos = lerQuantidade(dados.quantidade);
    const quantidade = decimal(centesimos);
    const tipo = dados.tipo;

    if (tipo !== "ENTRADA" && tipo !== "SAIDA") {
      throw new ErroValidacao(
        "Tipo de movimentação inválido.",
      );
    }

    if (
      dados.observacao !== undefined &&
      dados.observacao !== null &&
      typeof dados.observacao !== "string"
    ) {
      throw new ErroValidacao(
        "A observação é inválida.",
      );
    }

    const observacao =
      typeof dados.observacao === "string"
        ? dados.observacao.trim()
        : "";

    if (observacao.length > 255) {
      throw new ErroValidacao(
        "A observação deve ter no máximo 255 caracteres.",
      );
    }

    const produtoAtualizado = await prisma.$transaction(
      async (tx) => {
        const produto = await tx.produto.findUnique({
          where: {
            id_produto: idProduto,
          },
          select: {
            id_produto: true,
          },
        });

        if (!produto) {
          throw new ErroValidacao(
            "Produto não encontrado.",
            404,
          );
        }

        if (tipo === "SAIDA") {
          // Confere o saldo e desconta em uma única operação.
          const atualizacao = await tx.produto.updateMany({
            where: {
              id_produto: idProduto,
              quantidade: {
                gte: quantidade,
              },
            },
            data: {
              quantidade: {
                decrement: quantidade,
              },
              atualizado_em: new Date(),
            },
          });

          if (atualizacao.count !== 1) {
            throw new ErroValidacao(
              "A quantidade de saída é maior que o estoque disponível.",
            );
          }
        } else {
          const saldoMaximoAntesDaEntrada = decimal(
            MAXIMO_CENTESIMOS - centesimos,
          );

          const atualizacao = await tx.produto.updateMany({
            where: {
              id_produto: idProduto,
              quantidade: {
                lte: saldoMaximoAntesDaEntrada,
              },
            },
            data: {
              quantidade: {
                increment: quantidade,
              },
              atualizado_em: new Date(),
            },
          });

          if (atualizacao.count !== 1) {
            throw new ErroValidacao(
              "Essa entrada ultrapassa o limite numérico do estoque.",
            );
          }
        }

        await tx.move_estoque.create({
          data: {
            id_produto: idProduto,
            tipo_movimento: tipo,
            quantidade_move: quantidade,
            observacao: observacao || null,
            id_usuario: usuario.id_usuario,
          },
        });

        return tx.produto.findUniqueOrThrow({
          where: {
            id_produto: idProduto,
          },
        });
      },
    );

    return Response.json(
      {
        message: "Movimentação registrada com sucesso.",
        produto: produtoAtualizado,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof ErroAutenticacao ||
      error instanceof ErroValidacao
    ) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Erro ao movimentar estoque:", error);

    return Response.json(
      {
        error: "Não foi possível registrar a movimentação.",
      },
      { status: 500 },
    );
  }
}