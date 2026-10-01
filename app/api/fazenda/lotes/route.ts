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

async function lerDados(request: Request) {
  const dados = await request.json().catch(() => null);

  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados)
  ) {
    throw new ErroValidacao("Os dados enviados são inválidos.");
  }

  return dados;
}

function lerId(valor: unknown) {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao("Lote inválido.");
  }

  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ErroValidacao("Lote inválido.");
  }

  return id;
}

function lerNome(valor: unknown) {
  const nome =
    typeof valor === "string" ? valor.trim() : "";

  if (!nome || nome.length > 50) {
    throw new ErroValidacao(
      "Informe um nome com até 50 caracteres.",
    );
  }

  return nome;
}

function lerArea(valor: unknown) {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao("Informe a área do lote.");
  }

  const texto = String(valor).trim();

  if (!/^\d{1,8}(\.\d{1,2})?$/.test(texto)) {
    throw new ErroValidacao(
      "Informe uma área com até duas casas decimais, limitada a 99.999.999,99 hectares.",
    );
  }

  const [inteiro, fracao = ""] = texto.split(".");
  const centesimos =
    Number(inteiro) * 100 +
    Number(fracao.padEnd(2, "0"));

  if (centesimos <= 0) {
    throw new ErroValidacao(
      "A área do lote deve ser maior que zero.",
    );
  }

  return {
    centesimos,
    texto:
      `${Math.floor(centesimos / 100)}.` +
      String(centesimos % 100).padStart(2, "0"),
  };
}

function lerStatus(valor: unknown) {
  if (valor !== "ATIVO" && valor !== "INATIVO") {
    throw new ErroValidacao("Selecione um status válido.");
  }

  return valor;
}

function responderErro(error: unknown) {
  if (
    error instanceof ErroAutenticacao ||
    error instanceof ErroValidacao
  ) {
    return Response.json(
      { error: error.message },
      { status: error.status },
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2003"
  ) {
    return Response.json(
      {
        error:
          "Este lote possui registros vinculados e não pode ser excluído.",
      },
      { status: 409 },
    );
  }

  console.error("Erro na gestão de lotes:", error);

  return Response.json(
    { error: "Não foi possível concluir a operação." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    await exigirProprietario();

    const dados = await lerDados(request);
    const nome = lerNome(dados.nome);
    const area = lerArea(dados.area);

    await prisma.$transaction(async (tx) => {
      // Serializa cadastros e edições feitos por esta API.
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(73142, 3)::text AS bloqueio
      `;

      const existente = await tx.lote.findFirst({
        where: {
          nome_lote: {
            equals: nome,
            mode: "insensitive",
          },
        },
        select: {
          id_lote: true,
        },
      });

      if (existente) {
        throw new ErroValidacao(
          "Já existe um lote com esse nome.",
          409,
        );
      }

      await tx.lote.create({
        data: {
          nome_lote: nome,
          area: area.texto,
          status_lote: "ATIVO",
        },
      });
    });

    return Response.json(
      { message: "Lote cadastrado com sucesso." },
      { status: 201 },
    );
  } catch (error) {
    return responderErro(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await exigirProprietario();

    const dados = await lerDados(request);
    const id = lerId(dados.id);
    const nome = lerNome(dados.nome);
    const area = lerArea(dados.area);
    const status = lerStatus(dados.status);

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(73142, 3)::text AS bloqueio
      `;

      // Mesmo bloqueio usado no cadastro de plantios.
      await tx.$queryRaw`
        SELECT id_lote
        FROM lote
        WHERE id_lote = ${id}
        FOR UPDATE
      `;

      const lote = await tx.lote.findUnique({
        where: {
          id_lote: id,
        },
      });

      if (!lote) {
        throw new ErroValidacao("Lote não encontrado.", 404);
      }

      const nomeExistente = await tx.lote.findFirst({
        where: {
          id_lote: {
            not: id,
          },
          nome_lote: {
            equals: nome,
            mode: "insensitive",
          },
        },
        select: {
          id_lote: true,
        },
      });

      if (nomeExistente) {
        throw new ErroValidacao(
          "Já existe outro lote com esse nome.",
          409,
        );
      }

      const plantiosAtivos = await tx.plantio.findMany({
        where: {
          id_lote: id,
          status_plantio: {
            in: ["ATIVO", "EM ANDAMENTO"],
          },
        },
        select: {
          area_plantada: true,
        },
      });

      if (
        status === "INATIVO" &&
        plantiosAtivos.length > 0
      ) {
        throw new ErroValidacao(
          "Conclua os plantios ativos antes de desativar o lote.",
        );
      }

      const possuiAreaDesconhecida = plantiosAtivos.some(
        (plantio) => plantio.area_plantada === null,
      );

      const alterouArea = lote.area.toFixed(2) !== area.texto;

      if (possuiAreaDesconhecida && alterouArea) {
        throw new ErroValidacao(
          "Existe um plantio ativo sem área informada. Regularize esse registro antes de alterar a área do lote.",
        );
      }

      const areaOcupadaCentesimos = plantiosAtivos.reduce(
        (total, plantio) =>
          total +
          Math.round(Number(plantio.area_plantada ?? 0) * 100),
        0,
      );

      if (area.centesimos < areaOcupadaCentesimos) {
        const ocupacao = (
          areaOcupadaCentesimos / 100
        ).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

        throw new ErroValidacao(
          `A área do lote não pode ser menor que os ${ocupacao} ha ocupados pelos plantios ativos.`,
        );
      }

      await tx.lote.update({
        where: {
          id_lote: id,
        },
        data: {
          nome_lote: nome,
          area: area.texto,
          status_lote: status,
          atualizado_em: new Date(),
        },
      });
    });

    return Response.json({
      message: "Lote atualizado com sucesso.",
    });
  } catch (error) {
    return responderErro(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await exigirProprietario();

    const dados = await lerDados(request);
    const id = lerId(dados.id);

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(73142, 3)::text AS bloqueio
      `;

      await tx.$queryRaw`
        SELECT id_lote
        FROM lote
        WHERE id_lote = ${id}
        FOR UPDATE
      `;

      const lote = await tx.lote.findUnique({
        where: {
          id_lote: id,
        },
      });

      if (!lote) {
        throw new ErroValidacao("Lote não encontrado.", 404);
      }

      const plantios = await tx.plantio.count({
        where: {
          id_lote: id,
        },
      });

      if (plantios > 0) {
        throw new ErroValidacao(
          "Este lote possui histórico de plantios. Preserve os registros e use a desativação quando não houver plantios ativos.",
          409,
        );
      }

      await tx.lote.delete({
        where: {
          id_lote: id,
        },
      });
    });

    return Response.json({
      message: "Lote excluído com sucesso.",
    });
  } catch (error) {
    return responderErro(error);
  }
}