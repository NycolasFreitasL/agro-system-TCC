import { prisma } from "@/app/lib/prisma";

export async function POST(request: Request) {
  try {
    const dados = await request.json();

    const idLote = Number(dados.idLote);
    const idProduto = Number(dados.idProduto);
    const quantidade = Number(dados.quantidade);

    if (
      !idLote ||
      !idProduto ||
      !dados.dataPlantio ||
      !dados.status
    ) {
      return Response.json(
        {
          error:
            "Lote, cultura, data e status são obrigatórios.",
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
            "A quantidade precisa ser maior que zero.",
        },
        {
          status: 400,
        },
      );
    }

    const usuario =
      await prisma.usuarios.findFirst({
        orderBy: {
          id_usuario: "asc",
        },
      });

    if (!usuario) {
      return Response.json(
        {
          error:
            "Cadastre pelo menos um usuário.",
        },
        {
          status: 400,
        },
      );
    }

    const plantio = await prisma.plantio.create({
      data: {
        id_lote: idLote,
        id_produto: idProduto,

        data_plantio: new Date(
          `${dados.dataPlantio}T12:00:00`,
        ),

        prev_colheita: dados.previsaoColheita
          ? new Date(
              `${dados.previsaoColheita}T12:00:00`,
            )
          : null,

        quantidade_plantada:
          quantidade.toString(),

        status_plantio: dados.status,

        id_usuario: usuario.id_usuario,
      },
    });

    return Response.json(
      {
        message: "Plantio cadastrado com sucesso.",
        plantio,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Erro ao cadastrar plantio:",
      error,
    );

    return Response.json(
      {
        error: "Não foi possível cadastrar o plantio.",
      },
      {
        status: 500,
      },
    );
  }
}