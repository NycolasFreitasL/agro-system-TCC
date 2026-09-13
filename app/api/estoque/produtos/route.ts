import { prisma } from "@/app/lib/prisma";

export async function POST(request: Request) {
  try {
    const dados = await request.json();

    const nome =
      typeof dados.nome === "string"
        ? dados.nome.trim()
        : "";

    const categoria =
      typeof dados.categoria === "string"
        ? dados.categoria.trim()
        : "";

    const unidadeMedida =
      typeof dados.unidadeMedida === "string"
        ? dados.unidadeMedida.trim()
        : "";

    const quantidade = Number(dados.quantidade);
    const estoqueMinimo = Number(dados.estoqueMinimo);

    if (!nome || !categoria || !unidadeMedida) {
      return Response.json(
        {
          error:
            "Nome, categoria e unidade de medida são obrigatórios.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isFinite(quantidade) ||
      !Number.isFinite(estoqueMinimo) ||
      quantidade < 0 ||
      estoqueMinimo < 0
    ) {
      return Response.json(
        {
          error:
            "As quantidades precisam ser números maiores ou iguais a zero.",
        },
        {
          status: 400,
        },
      );
    }

    const produtoExistente =
      await prisma.produto.findFirst({
        where: {
          nome_produto: {
            equals: nome,
            mode: "insensitive",
          },
        },
      });

    if (produtoExistente) {
      return Response.json(
        {
          error:
            "Já existe um produto cadastrado com esse nome.",
        },
        {
          status: 409,
        },
      );
    }

    const produto = await prisma.produto.create({
      data: {
        nome_produto: nome,
        categoria,
        quantidade: quantidade.toString(),
        estoque_min: estoqueMinimo.toString(),
        unidade_medida: unidadeMedida,
      },
    });

    return Response.json(
      {
        message: "Produto cadastrado com sucesso.",
        produto,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Erro ao cadastrar produto:", error);

    return Response.json(
      {
        error: "Não foi possível cadastrar o produto.",
      },
      {
        status: 500,
      },
    );
  }
}