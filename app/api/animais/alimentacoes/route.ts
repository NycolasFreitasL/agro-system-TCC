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
    throw new ErroValidacao("Identificador inválido.");
  }

  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ErroValidacao("Identificador inválido.");
  }

  return id;
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

function lerData(valor: unknown) {
  if (
    typeof valor !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
    valor.startsWith("0000-")
  ) {
    throw new ErroValidacao("Informe uma data válida.");
  }

  const data = new Date(`${valor}T12:00:00.000Z`);

  if (
    Number.isNaN(data.getTime()) ||
    data.toISOString().slice(0, 10) !== valor
  ) {
    throw new ErroValidacao("Informe uma data válida.");
  }

  if (valor > hojeEmSaoPaulo()) {
    throw new ErroValidacao(
      "A alimentação não pode ter uma data futura.",
    );
  }

  return {
    data,
    texto: valor,
  };
}

function lerQuantidade(valor: unknown) {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao(
      "Informe a quantidade fornecida.",
    );
  }

  const texto = String(valor).trim();

  if (!/^\d{1,8}(\.\d{1,2})?$/.test(texto)) {
    throw new ErroValidacao(
      "Informe uma quantidade com até duas casas decimais e no máximo 99.999.999,99.",
    );
  }

  const [inteiro, fracao = ""] = texto.split(".");

  const centesimos =
    Number(inteiro) * 100 +
    Number(fracao.padEnd(2, "0"));

  if (centesimos <= 0) {
    throw new ErroValidacao(
      "A quantidade deve ser maior que zero.",
    );
  }

  return (
    `${Math.floor(centesimos / 100)}.` +
    String(centesimos % 100).padStart(2, "0")
  );
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

  console.error("Erro na API de alimentação:", error);

  return Response.json(
    {
      error: "Não foi possível processar a alimentação.",
    },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    await exigirUsuario();

    const url = new URL(request.url);
    const idAnimal = lerId(
      url.searchParams.get("idAnimal"),
    );

    const animal = await prisma.animal.findUnique({
      where: {
        id_animal: idAnimal,
      },
      select: {
        status_animal: true,
        data_nascimento: true,
      },
    });

    if (!animal) {
      throw new ErroValidacao(
        "Animal não encontrado.",
        404,
      );
    }

    if (animal.status_animal !== "ATIVO") {
      throw new ErroValidacao(
        "Só é possível registrar alimentação para animais ativos.",
      );
    }

    const produtos = await prisma.produto.findMany({
      where: {
        categoria: {
          equals: "Alimentação",
          mode: "insensitive",
        },
        quantidade: {
          gt: "0",
        },
      },
      select: {
        id_produto: true,
        nome_produto: true,
        quantidade: true,
        unidade_medida: true,
      },
      orderBy: {
        nome_produto: "asc",
      },
    });

    return Response.json(
      {
        produtos: produtos.map((produto) => ({
          id: produto.id_produto,
          nome: produto.nome_produto,
          saldo: produto.quantidade.toString(),
          unidade: produto.unidade_medida,
        })),
        hoje: hojeEmSaoPaulo(),
        nascimento:
          animal.data_nascimento
            ?.toISOString()
            .slice(0, 10) ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return responderErro(error);
  }
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

    const idAnimal = lerId(dados.idAnimal);
    const idProduto = lerId(dados.idProduto);
    const quantidade = lerQuantidade(dados.quantidade);
    const dataRegistro = lerData(dados.data);

    if (
      typeof dados.unidade !== "string" ||
      !dados.unidade.trim()
    ) {
      throw new ErroValidacao(
        "Selecione um produto com unidade de medida.",
      );
    }

    if (
      dados.observacao !== undefined &&
      dados.observacao !== null &&
      typeof dados.observacao !== "string"
    ) {
      throw new ErroValidacao(
        "A observação é inválida.",
      );
    }

    const observacao =
      typeof dados.observacao === "string"
        ? dados.observacao.trim()
        : "";

    if (observacao.length > 255) {
      throw new ErroValidacao(
        "A observação deve ter no máximo 255 caracteres.",
      );
    }

    const registro = await prisma.$transaction(async (tx) => {
      // Mantém os dados do animal estáveis durante o registro.
      await tx.$queryRaw`
        SELECT id_animal
        FROM animal
        WHERE id_animal = ${idAnimal}
        FOR UPDATE
      `;

      const animal = await tx.animal.findUnique({
        where: {
          id_animal: idAnimal,
        },
      });

      if (!animal) {
        throw new ErroValidacao(
          "Animal não encontrado.",
          404,
        );
      }

      if (animal.status_animal !== "ATIVO") {
        throw new ErroValidacao(
          "Só é possível registrar alimentação para animais ativos.",
        );
      }

      const nascimento = animal.data_nascimento
        ?.toISOString()
        .slice(0, 10);

      if (
        nascimento &&
        dataRegistro.texto < nascimento
      ) {
        throw new ErroValidacao(
          "A alimentação não pode acontecer antes do nascimento do animal.",
        );
      }

      // Confere os dados do produto com bloqueio durante a operação.
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
      });

      if (!produto) {
        throw new ErroValidacao(
          "Produto não encontrado.",
          404,
        );
      }

      if (
        produto.categoria.trim().toLocaleLowerCase("pt-BR") !==
        "alimentação"
      ) {
        throw new ErroValidacao(
          "Selecione um produto da categoria Alimentação.",
        );
      }

      if (produto.unidade_medida !== dados.unidade) {
        throw new ErroValidacao(
          "A unidade do produto mudou. Reabra o formulário e confira a quantidade.",
        );
      }

      const atualizacao = await tx.produto.updateMany({
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
          atualizado_em: new Date(),
        },
      });

      if (atualizacao.count !== 1) {
        throw new ErroValidacao(
          "A quantidade informada é maior que o estoque disponível.",
        );
      }

      const alimentacao = await tx.alimentacao.create({
        data: {
          id_animal: idAnimal,
          id_produto: idProduto,
          data_alimentacao: dataRegistro.data,
          quantidade_alimentacao: quantidade,
          observacao: observacao || null,
          id_usuario: usuario.id_usuario,
        },
      });

      await tx.move_estoque.create({
        data: {
          id_produto: idProduto,
          tipo_movimento: "SAIDA",
          quantidade_move: quantidade,
          observacao:
            `Alimentação #${alimentacao.id_alimentacao} — ` +
            `Animal #${idAnimal} — realizada em ${dataRegistro.texto}`,
          id_usuario: usuario.id_usuario,
        },
      });

      return alimentacao;
    });

    return Response.json(
      {
        message:
          "Alimentação registrada e estoque atualizado.",
        idAlimentacao: registro.id_alimentacao,
      },
      { status: 201 },
    );
  } catch (error) {
    return responderErro(error);
  }
}