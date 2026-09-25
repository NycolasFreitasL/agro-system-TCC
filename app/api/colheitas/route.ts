import { prisma } from "@/app/lib/prisma";

class ErroValidacao extends Error {}

function lerData(valor: unknown): Date | null {
  if (
    typeof valor !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    return null;
  }

  const data = new Date(`${valor}T12:00:00.000Z`);

  if (
    Number.isNaN(data.getTime()) ||
    data.toISOString().slice(0, 10) !== valor
  ) {
    return null;
  }

  return data;
}

function dataAtual() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  function parte(tipo: string) {
    return partes.find((item) => item.type === tipo)!.value;
  }

  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

export async function POST(request: Request) {
  try {
    const dados = await request.json().catch(() => {
      throw new ErroValidacao("Os dados enviados são inválidos.");
    });

    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroValidacao("Os dados enviados são inválidos.");
    }

    const idPlantio = Number(dados.idPlantio);
    const dataColheita = lerData(dados.data);

    const quantidadeTexto =
      typeof dados.quantidade === "string" ||
      typeof dados.quantidade === "number"
        ? String(dados.quantidade).trim()
        : "";

    const unidade =
      typeof dados.unidade === "string"
        ? dados.unidade.trim().toUpperCase()
        : "";

    const observacao =
      typeof dados.observacao === "string"
        ? dados.observacao.trim()
        : "";

    if (!Number.isInteger(idPlantio) || idPlantio <= 0) {
      throw new ErroValidacao("Selecione um plantio válido.");
    }

    if (!dataColheita) {
      throw new ErroValidacao("Informe uma data de colheita válida.");
    }

    if (dados.data > dataAtual()) {
      throw new ErroValidacao(
        "A data da colheita não pode estar no futuro.",
      );
    }

    if (
      !/^\d{1,8}(\.\d{1,2})?$/.test(quantidadeTexto) ||
      Number(quantidadeTexto) <= 0
    ) {
      throw new ErroValidacao(
        "Informe uma quantidade maior que zero, com até duas casas decimais e no máximo 99.999.999,99.",
      );
    }

    if (!["KG", "TONELADA", "SACA", "UNIDADE"].includes(unidade)) {
      throw new ErroValidacao("Selecione uma unidade válida.");
    }

    if (observacao.length > 255) {
      throw new ErroValidacao(
        "A observação deve ter no máximo 255 caracteres.",
      );
    }

    const colheita = await prisma.$transaction(async (tx) => {
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
        throw new ErroValidacao("Plantio não encontrado.");
      }

      if (
        plantio.status_plantio !== "ATIVO" &&
        plantio.status_plantio !== "EM ANDAMENTO"
      ) {
        throw new ErroValidacao(
          "Só é possível registrar colheitas em plantios ativos.",
        );
      }

      const diaPlantio = plantio.data_plantio
        .toISOString()
        .slice(0, 10);

      if (dados.data < diaPlantio) {
        throw new ErroValidacao(
          "A colheita não pode acontecer antes da data do plantio.",
        );
      }

      const usuario = await tx.usuarios.findFirst({
        orderBy: {
          id_usuario: "asc",
        },
      });

      if (!usuario) {
        throw new ErroValidacao(
          "Cadastre pelo menos um usuário antes de registrar a colheita.",
        );
      }

      return tx.colheita.create({
        data: {
          id_plantio: idPlantio,
          data_colheita: dataColheita,
          quantidade_colheita: quantidadeTexto,
          unidade_medida: unidade,
          observacao: observacao || null,
          id_usuario: usuario.id_usuario,
        },
      });
    });

    return Response.json(
      {
        message: "Colheita registrada com sucesso.",
        colheita,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ErroValidacao) {
      return Response.json(
        { error: error.message },
        { status: 400 },
      );
    }

    console.error("Erro ao registrar colheita:", error);

    return Response.json(
      { error: "Não foi possível registrar a colheita." },
      { status: 500 },
    );
  }
}