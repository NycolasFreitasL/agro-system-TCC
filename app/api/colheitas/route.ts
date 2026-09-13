import { prisma } from "@/app/lib/prisma";

export async function POST(request: Request) {
  try {
    const dados = await request.json();

    const idPlantio = Number(dados.idPlantio);
    const quantidade = Number(dados.quantidade);

    if (
      !idPlantio ||
      !dados.data ||
      !dados.unidade
    ) {
      return Response.json(
        {
          error:
            "Plantio, data e unidade são obrigatórios.",
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
            "A quantidade deve ser maior que zero.",
        },
        {
          status: 400,
        },
      );
    }

    const plantio =
      await prisma.plantio.findUnique({
        where: {
          id_plantio: idPlantio,
        },
      });

    if (!plantio) {
      return Response.json(
        {
          error: "Plantio não encontrado.",
        },
        {
          status: 404,
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

    const colheita = await prisma.colheita.create({
      data: {
        id_plantio: idPlantio,

        data_colheita: new Date(
          `${dados.data}T12:00:00`,
        ),

        quantidade_colheita:
          quantidade.toString(),

        unidade_medida: dados.unidade,

        observacao:
          typeof dados.observacao === "string" &&
          dados.observacao.trim()
            ? dados.observacao.trim()
            : null,

        id_usuario: usuario.id_usuario,
      },
    });

    return Response.json(
      {
        message:
          "Colheita registrada com sucesso.",
        colheita,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Erro ao registrar colheita:",
      error,
    );

    return Response.json(
      {
        error:
          "Não foi possível registrar a colheita.",
      },
      {
        status: 500,
      },
    );
  }
}