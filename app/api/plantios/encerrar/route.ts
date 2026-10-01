import { prisma } from "@/app/lib/prisma";
import {
  exigirUsuario,
  ErroAutenticacao,
} from "@/app/lib/sessao";

class ErroValidacao extends Error {}

export async function POST(request: Request) {
  try {
    await exigirUsuario();

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

    if (
      typeof dados.idPlantio !== "number" &&
      typeof dados.idPlantio !== "string"
    ) {
      throw new ErroValidacao(
        "Informe um plantio válido.",
      );
    }

    const idPlantio = Number(dados.idPlantio);

    if (
      !Number.isSafeInteger(idPlantio) ||
      idPlantio <= 0
    ) {
      throw new ErroValidacao(
        "Informe um plantio válido.",
      );
    }

    await prisma.$transaction(async (tx) => {
      // Mesmo bloqueio usado na API de colheitas.
      await tx.$queryRaw`
        SELECT id_plantio
        FROM plantio
        WHERE id_plantio = ${idPlantio}
        FOR UPDATE
      `;

      const plantio = await tx.plantio.findUnique({
        where: {
          id_plantio: idPlantio,
        },
      });

      if (!plantio) {
        throw new ErroValidacao(
          "Plantio não encontrado.",
        );
      }

      // Repetir a requisição não altera um cultivo já concluído.
      if (
        plantio.status_plantio === "CONCLUIDO" ||
        plantio.status_plantio === "CONCLUÍDO"
      ) {
        return;
      }

      if (
        plantio.status_plantio !== "ATIVO" &&
        plantio.status_plantio !== "EM ANDAMENTO"
      ) {
        throw new ErroValidacao(
          "Somente plantios ativos podem ser concluídos.",
        );
      }

      const quantidadeColheitas = await tx.colheita.count({
        where: {
          id_plantio: idPlantio,
        },
      });

      if (quantidadeColheitas === 0) {
        throw new ErroValidacao(
          "Registre a colheita antes de concluir o cultivo.",
        );
      }

      await tx.plantio.update({
        where: {
          id_plantio: idPlantio,
        },
        data: {
          status_plantio: "CONCLUIDO",
        },
      });
    });

    return Response.json({
      message: "Cultivo concluído. A área foi liberada.",
    });
  } catch (error) {
    if (error instanceof ErroAutenticacao) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof ErroValidacao) {
      return Response.json(
        { error: error.message },
        { status: 400 },
      );
    }

    console.error("Erro ao encerrar cultivo:", error);

    return Response.json(
      {
        error: "Não foi possível encerrar o cultivo.",
      },
      { status: 500 },
    );
  }
}