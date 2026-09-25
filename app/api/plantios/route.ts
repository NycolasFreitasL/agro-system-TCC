import { prisma } from "@/app/lib/prisma";

function lerData(valor: unknown): Date | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
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

function erro(mensagem: string, status = 400) {
  return Response.json({ error: mensagem }, { status });
}

export async function POST(request: Request) {
  try {
    const dados = await request.json();

    const idLote = Number(dados.idLote);
    const idProduto = Number(dados.idProduto);
    const quantidade = Number(dados.quantidade);
    const areaPlantada = Number(dados.areaPlantada);
    const dataPlantio = lerData(dados.dataPlantio);

    if (
      !Number.isInteger(idLote) ||
      idLote <= 0 ||
      !Number.isInteger(idProduto) ||
      idProduto <= 0
    ) {
      return erro("Selecione um lote e uma semente válidos.");
    }

    if (
      !Number.isFinite(quantidade) ||
      quantidade <= 0 ||
      !Number.isFinite(areaPlantada) ||
      areaPlantada <= 0
    ) {
      return erro(
        "A quantidade de sementes e a área plantada devem ser maiores que zero.",
      );
    }

    if (!dataPlantio) {
      return erro("Informe uma data de plantio válida.");
    }

    const hoje = new Date().toISOString().slice(0, 10);

    if (dados.dataPlantio > hoje) {
      return erro("A data do plantio não pode estar no futuro.");
    }

    const [lote, produto, usuario] = await Promise.all([
      prisma.lote.findUnique({
        where: { id_lote: idLote },
      }),
      prisma.produto.findUnique({
        where: { id_produto: idProduto },
        include: { cultura: true },
      }),
      prisma.usuarios.findFirst({
        orderBy: { id_usuario: "asc" },
      }),
    ]);

    if (!lote || lote.status_lote !== "ATIVO") {
      return erro("Selecione um lote ativo.");
    }

    if (areaPlantada > Number(lote.area)) {
      return erro("A área plantada não pode ultrapassar a área total do lote.");
    }

    if (
      !produto ||
      produto.categoria !== "Semente" ||
      !produto.cultura ||
      !produto.cultura.ativo
    ) {
      return erro("Selecione uma semente vinculada a uma cultura ativa.");
    }

    if (!usuario) {
      return erro("Cadastre pelo menos um usuário.");
    }

    const unidade = produto.unidade_medida.trim().toUpperCase();

    if (!["KG", "SACA", "UNIDADE", "MUDA"].includes(unidade)) {
      return erro("A unidade dessa semente não é aceita para plantio.");
    }

    let previsaoColheita: Date;

    if (dados.previsaoColheita) {
      const informada = lerData(dados.previsaoColheita);

      if (!informada) {
        return erro("Informe uma previsão de colheita válida.");
      }

      previsaoColheita = informada;
    } else {
      const cicloMedio = Math.round(
        (produto.cultura.ciclo_dias_min + produto.cultura.ciclo_dias_max) / 2,
      );

      previsaoColheita = new Date(dataPlantio);
      previsaoColheita.setUTCDate(previsaoColheita.getUTCDate() + cicloMedio);
    }

    if (previsaoColheita <= dataPlantio) {
      return erro("A previsão de colheita deve ser posterior ao plantio.");
    }

    const germinacaoMedia = Math.round(
      (produto.cultura.dias_germinacao_min +
        produto.cultura.dias_germinacao_max) /
        2,
    );

    const previsaoGerminacao = new Date(dataPlantio);
    previsaoGerminacao.setUTCDate(
      previsaoGerminacao.getUTCDate() + germinacaoMedia,
    );

    const plantio = await prisma.$transaction(async (tx) => {
      // Impede dois cadastros simultâneos de ocuparem
      // a mesma área disponível do lote.
      await tx.$queryRaw`
          SELECT id_lote
          FROM lote
          WHERE id_lote = ${idLote}
          FOR UPDATE
        `;

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
        throw new Error("PLANTIO_ANTIGO_SEM_AREA");
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

      const areaOcupada = Number(ocupacao._sum.area_plantada ?? 0);

      if (
        Math.round((areaOcupada + areaPlantada) * 100) >
        Math.round(Number(lote.area) * 100)
      ) {
        throw new Error("AREA_INSUFICIENTE");
      }

      const desconto = await tx.produto.updateMany({
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
        },
      });

      if (desconto.count !== 1) {
        throw new Error("ESTOQUE_INSUFICIENTE");
      }

      const novoPlantio = await tx.plantio.create({
        data: {
          id_lote: idLote,
          id_produto: idProduto,
          id_cultura: produto.cultura!.id_cultura,
          area_plantada: areaPlantada.toString(),
          data_plantio: dataPlantio,
          prev_germinacao: previsaoGerminacao,
          prev_colheita: previsaoColheita,
          quantidade_plantada: quantidade.toString(),
          unidade_plantada: unidade,
          status_plantio: "ATIVO",
          id_usuario: usuario.id_usuario,
        },
      });

      await tx.move_estoque.create({
        data: {
          id_produto: idProduto,
          tipo_movimento: "SAIDA",
          quantidade_move: quantidade.toString(),
          observacao: `Sementes utilizadas no plantio #${novoPlantio.id_plantio}`,
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
    if (error instanceof Error) {
      if (error.message === "ESTOQUE_INSUFICIENTE") {
        return erro(
          "Não há sementes suficientes no estoque para esse plantio.",
        );
      }

      if (error.message === "PLANTIO_ANTIGO_SEM_AREA") {
        return erro(
          "Este lote possui um plantio ativo antigo sem área informada. Ajuste esse registro antes de criar outro plantio no lote.",
        );
      }

      if (error.message === "AREA_INSUFICIENTE") {
        return erro(
          "A soma das áreas plantadas ultrapassa a área disponível no lote.",
        );
      }
    }

    console.error("Erro ao cadastrar plantio:", error);
    return erro("Não foi possível cadastrar o plantio.", 500);
  }
}
