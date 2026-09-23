import { prisma } from "@/app/lib/prisma";

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
      quantidade <= 0
    ) {
      return erro("A quantidade plantada deve ser maior que zero.");
    }

    

    if (
      !Number.isFinite(areaPlantada) ||
      areaPlantada <= 0
    ) {
      return erro("A área plantada deve ser maior que zero.");
    }

    if (!dataPlantio) {
      return erro("Informe uma data de plantio válida.");
    }

    const hoje = new Date();
    const hojeTexto = hoje.toISOString().slice(0, 10);

    if (dados.dataPlantio > hojeTexto) {
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

    if (
      !produto ||
      produto.categoria !== "Semente" ||
      !produto.cultura ||
      !produto.cultura.ativo
    ) {
      return erro(
        "Selecione uma semente vinculada a uma cultura ativa.",
      );
    }

    if (!usuario) {
      return erro("Cadastre pelo menos um usuário.");
    }

    let previsaoColheita: Date;

    if (dados.previsaoColheita) {
      const dataInformada = lerData(dados.previsaoColheita);

      if (!dataInformada) {
        return erro("Informe uma previsão de colheita válida.");
      }

      previsaoColheita = dataInformada;
    } else {
      const cicloMedio = Math.round(
        (produto.cultura.ciclo_dias_min +
          produto.cultura.ciclo_dias_max) /
          2,
      );

      previsaoColheita = new Date(dataPlantio);
      previsaoColheita.setUTCDate(
        previsaoColheita.getUTCDate() + cicloMedio,
      );
    }

    if (previsaoColheita <= dataPlantio) {
      return erro(
        "A previsão de colheita deve ser posterior ao plantio.",
      );
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

    if (
      dados.areaPlantada !== undefined &&
      (
        !Number.isFinite(areaPlantada) ||
        areaPlantada <= 0 ||
        areaPlantada > Number(lote.area)
      )
    ) {
      return erro(
        "A área plantada deve ser maior que zero e não pode ultrapassar a área do lote.",
      );
    }

    const plantio = await prisma.plantio.create({
      data: {
        id_lote: idLote,
        id_produto: idProduto,
        id_cultura: produto.cultura.id_cultura,
        data_plantio: dataPlantio,
        prev_germinacao: previsaoGerminacao,
        prev_colheita: previsaoColheita,
        quantidade_plantada: quantidade.toString(),
        unidade_plantada: produto.unidade_medida,
        status_plantio: "ATIVO",
        id_usuario: usuario.id_usuario,
        area_plantada:
        dados.areaPlantada === undefined
        ? null
        : areaPlantada.toString(),
      },
    });

    return Response.json(
      {
        message: "Plantio cadastrado com sucesso.",
        plantio,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Erro ao cadastrar plantio:", error);

    return erro("Não foi possível cadastrar o plantio.", 500);
  }
}