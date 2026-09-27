import { prisma } from "@/app/lib/prisma";

class ErroValidacao extends Error {}

const MAXIMO_CENTAVOS_KG = 9999999999;
const DIA_EM_MS = 24 * 60 * 60 * 1000;

const ZERO = BigInt(0);
const CEM = BigInt(100);
const MIL = BigInt(1000);

function dataAtual() {
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

function lerId(valor: unknown) {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao("Identificador inválido.");
  }

  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ErroValidacao("Identificador inválido.");
  }

  return id;
}

// Converte a quantidade recebida para centésimos de kg.
function quantidadeEmCentesimos(
  valor: unknown,
  unidade: unknown,
) {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao("Informe a quantidade colhida.");
  }

  const texto = String(valor).trim();

  if (!/^\d{1,8}(\.\d{1,2})?$/.test(texto)) {
    throw new ErroValidacao(
      "Informe uma quantidade com até duas casas decimais.",
    );
  }

  if (unidade !== "KG" && unidade !== "TONELADA") {
    throw new ErroValidacao(
      "Selecione quilogramas ou toneladas.",
    );
  }

  const [inteiro, fracao = ""] = texto.split(".");

  let centesimos =
    Number(inteiro) * 100 +
    Number(fracao.padEnd(2, "0"));

  if (unidade === "TONELADA") {
    centesimos *= 1000;
  }

  if (
    !Number.isSafeInteger(centesimos) ||
    centesimos <= 0 ||
    centesimos > MAXIMO_CENTAVOS_KG
  ) {
    throw new ErroValidacao(
      "A quantidade deve ser positiva e não pode ultrapassar 99.999.999,99 kg.",
    );
  }

  return centesimos;
}

function decimal(centesimos: number) {
  const inteiro = Math.floor(centesimos / 100);
  const fracao = String(centesimos % 100).padStart(2, "0");

  return `${inteiro}.${fracao}`;
}

// Usa inteiros de precisão arbitrária na soma e na
// multiplicação de área por produtividade.
function decimalEmCentesimos(
  valor: string,
  mensagemErro: string,
): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(valor)) {
    throw new ErroValidacao(mensagemErro);
  }

  const [inteiro, fracao = ""] = valor.split(".");

  return (
    BigInt(inteiro) * CEM +
    BigInt(fracao.padEnd(2, "0"))
  );
}

function formatarKg(centesimos: bigint) {
  const inteiro = centesimos / CEM;
  const fracao = String(centesimos % CEM).padStart(2, "0");

  return `${inteiro.toLocaleString("pt-BR")},${fracao} kg`;
}

function respostaErro(error: unknown) {
  if (error instanceof ErroValidacao) {
    return Response.json(
      { error: error.message },
      { status: 400 },
    );
  }

  console.error("Erro na API de colheitas:", error);

  return Response.json(
    { error: "Não foi possível processar a colheita." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const idPlantio = lerId(
      url.searchParams.get("idPlantio"),
    );

    const plantio = await prisma.plantio.findUnique({
      where: {
        id_plantio: idPlantio,
      },
    });

    if (!plantio || plantio.id_cultura === null) {
      throw new ErroValidacao(
        "O plantio precisa estar vinculado a uma cultura.",
      );
    }

    if (
      plantio.status_plantio !== "ATIVO" &&
      plantio.status_plantio !== "EM ANDAMENTO"
    ) {
      throw new ErroValidacao(
        "Só é possível colher em plantios ativos.",
      );
    }

    const produtos = await prisma.produto.findMany({
      where: {
        id_cultura: plantio.id_cultura,
        categoria: "Outro",
        unidade_medida: {
          equals: "kg",
          mode: "insensitive",
        },
        id_produto: {
          not: plantio.id_produto,
        },
      },
      select: {
        id_produto: true,
        nome_produto: true,
      },
      orderBy: {
        nome_produto: "asc",
      },
    });

    return Response.json(
      {
        produtos,
        dataPlantio: plantio.data_plantio
          .toISOString()
          .slice(0, 10),
        hoje: dataAtual(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return respostaErro(error);
  }
}

export async function POST(request: Request) {
  try {
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

    const idPlantio = lerId(dados.idPlantio);
    const idProdutoDestino = lerId(dados.idProdutoDestino);

    const dataColheita = lerData(dados.data);

    if (!dataColheita) {
      throw new ErroValidacao("Informe uma data válida.");
    }

    const dataColheitaTexto = dataColheita
      .toISOString()
      .slice(0, 10);

    if (dataColheitaTexto > dataAtual()) {
      throw new ErroValidacao(
        "A colheita não pode ter uma data futura.",
      );
    }

    const centesimos = quantidadeEmCentesimos(
      dados.quantidade,
      dados.unidade,
    );

    const quantidadeKg = decimal(centesimos);

    const observacao =
      typeof dados.observacao === "string"
        ? dados.observacao.trim()
        : "";

    if (observacao.length > 255) {
      throw new ErroValidacao(
        "A observação deve ter no máximo 255 caracteres.",
      );
    }

    await prisma.$transaction(async (tx) => {
      // Serializa colheitas e encerramento do mesmo plantio.
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
        include: {
          cultura: true,
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

      const cultura = plantio.cultura;

      if (!cultura) {
        throw new ErroValidacao(
          "O plantio precisa estar vinculado a uma cultura.",
        );
      }

      const inicioTexto = plantio.data_plantio
        .toISOString()
        .slice(0, 10);

      if (dataColheitaTexto < inicioTexto) {
        throw new ErroValidacao(
          "A colheita não pode acontecer antes do plantio.",
        );
      }

      const produto = await tx.produto.findUnique({
        where: {
          id_produto: idProdutoDestino,
        },
      });

      if (
        !produto ||
        produto.id_produto === plantio.id_produto ||
        produto.id_cultura !== plantio.id_cultura ||
        produto.categoria !== "Outro" ||
        produto.unidade_medida.trim().toUpperCase() !== "KG"
      ) {
        throw new ErroValidacao(
          "Selecione um produto colhido da mesma cultura, cadastrado em kg.",
        );
      }

      // Confere os dados necessários para as estimativas.
      if (plantio.area_plantada === null) {
        throw new ErroValidacao(
          "Informe a área ocupada por este plantio antes de registrar a colheita.",
        );
      }

      const areaCentesimos = decimalEmCentesimos(
        plantio.area_plantada.toFixed(2),
        "A área deste plantio é inválida.",
      );

      if (areaCentesimos <= ZERO) {
        throw new ErroValidacao(
          "A área deste plantio precisa ser maior que zero.",
        );
      }

      const cicloMinimo = cultura.ciclo_dias_min;

      if (
        !Number.isSafeInteger(cicloMinimo) ||
        cicloMinimo <= 0
      ) {
        throw new ErroValidacao(
          "Cadastre um ciclo mínimo válido para esta cultura.",
        );
      }

      const produtividadeCentesimos = decimalEmCentesimos(
        cultura.produtividade_max_kg_ha.toFixed(2),
        "A produtividade de referência da cultura é inválida.",
      );

      if (produtividadeCentesimos <= ZERO) {
        throw new ErroValidacao(
          "Cadastre uma produtividade máxima de referência maior que zero para esta cultura.",
        );
      }

      const alertas: string[] = [];

      // Calcula dias de calendário usando o mesmo horário UTC.
      const inicio = lerData(inicioTexto);

      if (!inicio) {
        throw new ErroValidacao(
          "A data de plantio cadastrada é inválida.",
        );
      }

      const diasDesdePlantio = Math.round(
        (dataColheita.getTime() - inicio.getTime()) /
          DIA_EM_MS,
      );

      if (diasDesdePlantio < cicloMinimo) {
        alertas.push(
          `Colheita antecipada: foram informados ${diasDesdePlantio} dias após o plantio, mas o ciclo mínimo cadastrado para ${cultura.nome_cultura} é de ${cicloMinimo} dias.`,
        );
      }

      // Inclui todas as colheitas já registradas no plantio,
      // independentemente da data ou do produto de destino.
      const colheitasAnteriores = await tx.colheita.findMany({
        where: {
          id_plantio: idPlantio,
        },
        select: {
          id_colheita: true,
          quantidade_colheita: true,
          unidade_medida: true,
        },
      });

      let totalAnteriorCentesimos = ZERO;

      for (const colheita of colheitasAnteriores) {
        const unidade = colheita.unidade_medida
          .trim()
          .toUpperCase();

        let quantidadeAnterior = decimalEmCentesimos(
          colheita.quantidade_colheita.toFixed(2),
          `A quantidade da colheita #${colheita.id_colheita} é inválida. Revise esse registro.`,
        );

        if (unidade === "TONELADA") {
          quantidadeAnterior *= MIL;
        } else if (unidade !== "KG") {
          throw new ErroValidacao(
            `A colheita #${colheita.id_colheita} está registrada em "${colheita.unidade_medida}". É necessário revisar sua conversão para kg antes de calcular a produção acumulada.`,
          );
        }

        totalAnteriorCentesimos += quantidadeAnterior;
      }

      const totalComNovaColheita =
        totalAnteriorCentesimos + BigInt(centesimos);

      // Área e produtividade estão multiplicadas por 100.
      // A comparação preserva a precisão sem usar floats.
      const referenciaEscalada =
        areaCentesimos * produtividadeCentesimos;

      if (totalComNovaColheita * CEM > referenciaEscalada) {
        // Arredondamento apenas para exibir a referência.
        const referenciaCentesimos =
          (referenciaEscalada + BigInt(50)) / CEM;

        alertas.push(
          `Produção acima da referência: o total acumulado ficará em ${formatarKg(totalComNovaColheita)}, enquanto a referência para a área deste plantio é de ${formatarKg(referenciaCentesimos)}.`,
        );
      }

      // O modal existente já envia o campo Observação.
      // Fora das referências, esse texto é a justificativa.
      const tamanhoJustificativa = observacao.replace(
        /\s+/g,
        " ",
      ).length;

      if (
        alertas.length > 0 &&
        tamanhoJustificativa < 10
      ) {
        throw new ErroValidacao(
          `${alertas.join(" ")} Para continuar, explique o motivo no campo Observação, com pelo menos 10 caracteres.`,
        );
      }

      const usuario = await tx.usuarios.findFirst({
        orderBy: {
          id_usuario: "asc",
        },
      });

      if (!usuario) {
        throw new ErroValidacao(
          "Cadastre pelo menos um usuário.",
        );
      }

      const saldoMaximoAntesDaEntrada = decimal(
        MAXIMO_CENTAVOS_KG - centesimos,
      );

      const atualizacao = await tx.produto.updateMany({
        where: {
          id_produto: idProdutoDestino,
          quantidade: {
            lte: saldoMaximoAntesDaEntrada,
          },
        },
        data: {
          quantidade: {
            increment: quantidadeKg,
          },
          atualizado_em: new Date(),
        },
      });

      if (atualizacao.count !== 1) {
        throw new ErroValidacao(
          "Essa entrada ultrapassa a capacidade numérica do estoque.",
        );
      }

      const colheita = await tx.colheita.create({
        data: {
          id_plantio: idPlantio,
          id_produto_destino: idProdutoDestino,
          data_colheita: dataColheita,
          quantidade_colheita: quantidadeKg,
          unidade_medida: "KG",
          observacao: observacao || null,
          id_usuario: usuario.id_usuario,
        },
      });

      await tx.move_estoque.create({
        data: {
          id_produto: idProdutoDestino,
          tipo_movimento: "ENTRADA",
          quantidade_move: quantidadeKg,
          observacao:
            `Colheita #${colheita.id_colheita} — ` +
            `Plantio #${idPlantio}`,
          id_usuario: usuario.id_usuario,
        },
      });
    });

    return Response.json(
      {
        message: "Colheita registrada e estoque atualizado.",
      },
      { status: 201 },
    );
  } catch (error) {
    return respostaErro(error);
  }
}