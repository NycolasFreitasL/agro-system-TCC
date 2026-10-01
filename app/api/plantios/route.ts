import { prisma } from "@/app/lib/prisma";
import {
  exigirUsuario,
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

function lerId(valor: unknown) {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao(
      "Selecione um lote e uma semente válidos.",
    );
  }

  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ErroValidacao(
      "Selecione um lote e uma semente válidos.",
    );
  }

  return id;
}

function lerDecimalPositivo(
  valor: unknown,
  campo: string,
) {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao(`Informe ${campo}.`);
  }

  const texto = String(valor).trim();

  if (!/^\d{1,8}(\.\d{1,2})?$/.test(texto)) {
    throw new ErroValidacao(
      `${campo} deve ter até duas casas decimais e não pode ultrapassar 99.999.999,99.`,
    );
  }

  const [inteiro, fracao = ""] = texto.split(".");

  const centesimos =
    Number(inteiro) * 100 +
    Number(fracao.padEnd(2, "0"));

  if (centesimos <= 0) {
    throw new ErroValidacao(
      `${campo} deve ser maior que zero.`,
    );
  }

  return {
    centesimos,
    decimal:
      `${Math.floor(centesimos / 100)}.` +
      String(centesimos % 100).padStart(2, "0"),
  };
}

function lerData(valor: unknown): Date | null {
  if (
    typeof valor !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
    valor.startsWith("0000-")
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

function hojeEmSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const parte = (tipo: string) =>
    partes.find((item) => item.type === tipo)!.value;

  return `${parte("year")}-${parte("month")}-${parte("day")}`;
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

  console.error("Erro ao cadastrar plantio:", error);

  return Response.json(
    { error: "Não foi possível cadastrar o plantio." },
    { status: 500 },
  );
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

    const idLote = lerId(dados.idLote);
    const idProduto = lerId(dados.idProduto);

    const quantidade = lerDecimalPositivo(
      dados.quantidade,
      "A quantidade de sementes",
    );

    const areaPlantada = lerDecimalPositivo(
      dados.areaPlantada,
      "A área plantada",
    );

    const dataPlantio = lerData(dados.dataPlantio);

    if (!dataPlantio) {
      throw new ErroValidacao(
        "Informe uma data de plantio válida.",
      );
    }

    if (
      dataPlantio.toISOString().slice(0, 10) >
      hojeEmSaoPaulo()
    ) {
      throw new ErroValidacao(
        "A data do plantio não pode estar no futuro.",
      );
    }

    let previsaoInformada: Date | null = null;

    if (
      dados.previsaoColheita !== undefined &&
      dados.previsaoColheita !== null &&
      dados.previsaoColheita !== ""
    ) {
      previsaoInformada = lerData(dados.previsaoColheita);

      if (!previsaoInformada) {
        throw new ErroValidacao(
          "Informe uma previsão de colheita válida.",
        );
      }

      if (previsaoInformada <= dataPlantio) {
        throw new ErroValidacao(
          "A previsão de colheita deve ser posterior ao plantio.",
        );
      }
    }

    const plantio = await prisma.$transaction(async (tx) => {
      // Serializa os cadastros que usam o mesmo lote.
      await tx.$queryRaw`
        SELECT id_lote
        FROM lote
        WHERE id_lote = ${idLote}
        FOR UPDATE
      `;

      const lote = await tx.lote.findUnique({
        where: {
          id_lote: idLote,
        },
      });

      if (!lote || lote.status_lote !== "ATIVO") {
        throw new ErroValidacao(
          "Selecione um lote ativo.",
        );
      }

      const areaTotalCentesimos = Math.round(
        Number(lote.area) * 100,
      );

      if (areaPlantada.centesimos > areaTotalCentesimos) {
        throw new ErroValidacao(
          "A área plantada não pode ultrapassar a área total do lote.",
        );
      }

      const plantiosSemArea = await tx.plantio.count({
        where: {
          id_lote: idLote,
          status_plantio: {
            in: ["ATIVO", "EM ANDAMENTO"],
          },
          area_plantada: null,
        },
      });

      if (plantiosSemArea > 0) {
        throw new ErroValidacao(
          "Este lote possui um plantio ativo antigo sem área informada. Ajuste esse registro antes de criar outro plantio no lote.",
        );
      }

      const ocupacao = await tx.plantio.aggregate({
        where: {
          id_lote: idLote,
          status_plantio: {
            in: ["ATIVO", "EM ANDAMENTO"],
          },
        },
        _sum: {
          area_plantada: true,
        },
      });

      const areaOcupadaCentesimos = Math.round(
        Number(ocupacao._sum.area_plantada ?? 0) * 100,
      );

      if (
        areaOcupadaCentesimos + areaPlantada.centesimos >
        areaTotalCentesimos
      ) {
        throw new ErroValidacao(
          "A soma das áreas plantadas ultrapassa a área disponível no lote.",
        );
      }

      // Mantém os dados da semente estáveis durante o cadastro.
      await tx.$queryRaw`
        SELECT id_produto
        FROM produto
        WHERE id_produto = ${idProduto}
        FOR UPDATE
      `;

      const produto = await tx.produto.findUnique({
        where: {
          id_produto: idProduto,
        },
        include: {
          cultura: true,
        },
      });

      if (
        !produto ||
        produto.categoria !== "Semente" ||
        !produto.cultura ||
        !produto.cultura.ativo
      ) {
        throw new ErroValidacao(
          "Selecione uma semente vinculada a uma cultura ativa.",
        );
      }

      const cultura = produto.cultura;
      const unidade = produto.unidade_medida
        .trim()
        .toUpperCase();

      if (
        !["KG", "SACA", "UNIDADE", "MUDA"].includes(unidade)
      ) {
        throw new ErroValidacao(
          "A unidade dessa semente não é aceita para plantio.",
        );
      }

      let previsaoColheita: Date;

      if (previsaoInformada) {
        previsaoColheita = previsaoInformada;
      } else {
        const cicloMinimo = cultura.ciclo_dias_min;
        const cicloMaximo = cultura.ciclo_dias_max;

        if (
          !Number.isInteger(cicloMinimo) ||
          !Number.isInteger(cicloMaximo) ||
          cicloMinimo <= 0 ||
          cicloMaximo < cicloMinimo
        ) {
          throw new ErroValidacao(
            "Revise o ciclo de cultivo cadastrado para esta cultura.",
          );
        }

        const cicloMedio = Math.round(
          (cicloMinimo + cicloMaximo) / 2,
        );

        previsaoColheita = new Date(dataPlantio);
        previsaoColheita.setUTCDate(
          previsaoColheita.getUTCDate() + cicloMedio,
        );
      }

      if (
        Number.isNaN(previsaoColheita.getTime()) ||
        previsaoColheita <= dataPlantio
      ) {
        throw new ErroValidacao(
          "A previsão de colheita deve ser uma data válida posterior ao plantio.",
        );
      }

      const germinacaoMinima = cultura.dias_germinacao_min;
      const germinacaoMaxima = cultura.dias_germinacao_max;

      if (
        !Number.isInteger(germinacaoMinima) ||
        !Number.isInteger(germinacaoMaxima) ||
        germinacaoMinima < 0 ||
        germinacaoMaxima < germinacaoMinima
      ) {
        throw new ErroValidacao(
          "Revise os dias de germinação cadastrados para esta cultura.",
        );
      }

      const germinacaoMedia = Math.round(
        (germinacaoMinima + germinacaoMaxima) / 2,
      );

      const previsaoGerminacao = new Date(dataPlantio);

      previsaoGerminacao.setUTCDate(
        previsaoGerminacao.getUTCDate() + germinacaoMedia,
      );

      if (Number.isNaN(previsaoGerminacao.getTime())) {
        throw new ErroValidacao(
          "Não foi possível calcular a previsão de germinação.",
        );
      }

      const desconto = await tx.produto.updateMany({
        where: {
          id_produto: idProduto,
          quantidade: {
            gte: quantidade.decimal,
          },
        },
        data: {
          quantidade: {
            decrement: quantidade.decimal,
          },
          atualizado_em: new Date(),
        },
      });

      if (desconto.count !== 1) {
        throw new ErroValidacao(
          "Não há sementes suficientes no estoque para esse plantio.",
        );
      }

      const novoPlantio = await tx.plantio.create({
        data: {
          id_lote: idLote,
          id_produto: idProduto,
          id_cultura: cultura.id_cultura,
          area_plantada: areaPlantada.decimal,
          data_plantio: dataPlantio,
          prev_germinacao: previsaoGerminacao,
          prev_colheita: previsaoColheita,
          quantidade_plantada: quantidade.decimal,
          unidade_plantada: unidade,
          status_plantio: "ATIVO",
          id_usuario: usuario.id_usuario,
        },
      });

      await tx.move_estoque.create({
        data: {
          id_produto: idProduto,
          tipo_movimento: "SAIDA",
          quantidade_move: quantidade.decimal,
          observacao:
            `Sementes utilizadas no plantio #${novoPlantio.id_plantio}`,
          id_usuario: usuario.id_usuario,
        },
      });

      return novoPlantio;
    });

    return Response.json(
      {
        message: "Plantio cadastrado com sucesso.",
        plantio,
      },
      { status: 201 },
    );
  } catch (error) {
    return responderErro(error);
  }
}