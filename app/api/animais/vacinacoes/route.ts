import { prisma } from "@/app/lib/prisma";
import { incompatibilidadeDose } from "@/app/lib/estoque-regras";
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
      "A vacinação não pode ter uma data futura.",
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
      "Informe a quantidade de doses aplicada.",
    );
  }

  const texto = String(valor).trim();

  if (!/^\d{1,3}$/.test(texto)) {
    throw new ErroValidacao(
      "Informe doses completas: 1, 2, 3… Não são aceitas frações de dose.",
    );
  }

  const quantidade = Number(texto);

  if (
    !Number.isInteger(quantidade) ||
    quantidade < 1 ||
    quantidade > 999
  ) {
    throw new ErroValidacao(
      "A quantidade deve ser um número inteiro entre 1 e 999.",
    );
  }

  return quantidade.toFixed(2);
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

  console.error("Erro na API de vacinação:", error);

  return Response.json(
    {
      error: "Não foi possível processar a vacinação.",
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
        "Só é possível registrar vacinação para animais ativos.",
      );
    }

    const produtos = await prisma.produto.findMany({
      where: {
        categoria: {
          equals: "Vacina",
          mode: "insensitive",
        },
      },
      select: {
        id_produto: true,
        nome_produto: true,
        quantidade: true,
        categoria: true,
        unidade_medida: true,
        estoque_min: true,
      },
      orderBy: {
        nome_produto: "asc",
      },
    });

    return Response.json(
      {
        produtos: produtos.filter((produto) =>
          !incompatibilidadeDose(produto) && Number(produto.quantidade) >= 1,
        ).map((produto) => ({
          id: produto.id_produto,
          nome: produto.nome_produto,
          saldo: produto.quantidade.toString(),
        })),
        incompatibilidades: produtos.flatMap((produto) => {
          const motivo = incompatibilidadeDose(produto);
          return motivo ? [{ id: produto.id_produto, nome: produto.nome_produto, motivo }] : [];
        }),
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
          "Só é possível registrar vacinação para animais ativos.",
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
          "A vacinação não pode acontecer antes do nascimento do animal.",
        );
      }

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
        produto.categoria.trim().toUpperCase() !== "VACINA"
      ) {
        throw new ErroValidacao(
          "Selecione um produto da categoria Vacina.",
        );
      }

      if (
        produto.unidade_medida.trim().toUpperCase() !== "DOSE"
      ) {
        throw new ErroValidacao(
          "Esta operação aceita apenas vacinas cadastradas em Dose. Não há conversão automática de ML para doses.",
        );
      }

      const incompatibilidade = incompatibilidadeDose(produto);
      if (incompatibilidade) {
        throw new ErroValidacao(incompatibilidade, 409);
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
          "A quantidade aplicada é maior que o estoque disponível.",
        );
      }

      const vacinacao = await tx.vacinacao.create({
        data: {
          id_animal: idAnimal,
          id_produto: idProduto,
          data_vacina: dataRegistro.data,
          dose_vacina: quantidade,
          unidade_dose: "DOSE",
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
            `Vacinação #${vacinacao.id_vacina} — ` +
            `Animal #${idAnimal} — realizada em ${dataRegistro.texto}`,
          id_usuario: usuario.id_usuario,
        },
      });

      return vacinacao;
    });

    return Response.json(
      {
        message:
          "Vacinação registrada e estoque atualizado.",
        idVacinacao: registro.id_vacina,
      },
      { status: 201 },
    );
  } catch (error) {
    return responderErro(error);
  }
}
