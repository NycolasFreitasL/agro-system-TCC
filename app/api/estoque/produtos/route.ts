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

const CATEGORIAS = [
  "Alimentação",
  "Fertilizante",
  "Semente",
  "Produto colhido",
  "Vacina",
  "Medicamento",
  "Ferramenta",
  "Outro",
];

const UNIDADES: Record<string, string> = {
  KG: "KG",
  G: "G",
  L: "L",
  ML: "ML",
  UNIDADE: "Unidade",
  SACA: "Saca",
  DOSE: "Dose",
};

function lerQuantidade(
  valor: unknown,
  campo: string,
): string {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao(`Informe ${campo}.`);
  }

  const texto = String(valor).trim();

  if (!/^\d{1,8}(\.\d{1,2})?$/.test(texto)) {
    throw new ErroValidacao(
      `${campo} deve estar entre 0 e 99.999.999,99, com até duas casas decimais.`,
    );
  }

  const [inteiro, fracao = ""] = texto.split(".");

  return `${Number(inteiro)}.${fracao.padEnd(2, "0")}`;
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

  console.error("Erro na API de produtos:", error);

  return Response.json(
    {
      error: "Não foi possível processar a solicitação.",
    },
    { status: 500 },
  );
}

export async function GET() {
  try {
    await exigirUsuario();

    const culturas = await prisma.cultura.findMany({
      where: {
        ativo: true,
      },
      select: {
        id_cultura: true,
        nome_cultura: true,
      },
      orderBy: {
        nome_cultura: "asc",
      },
    });

    return Response.json(
      { culturas },
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

    const nome =
      typeof dados.nome === "string"
        ? dados.nome.trim()
        : "";

    const categoria =
      typeof dados.categoria === "string"
        ? dados.categoria.trim()
        : "";

    const unidadeInformada =
      typeof dados.unidadeMedida === "string"
        ? dados.unidadeMedida.trim().toUpperCase()
        : "";

    if (!nome || nome.length > 100) {
      throw new ErroValidacao(
        "O nome do produto deve ter entre 1 e 100 caracteres.",
      );
    }

    if (!CATEGORIAS.includes(categoria)) {
      throw new ErroValidacao(
        "Selecione uma categoria válida.",
      );
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        UNIDADES,
        unidadeInformada,
      )
    ) {
      throw new ErroValidacao(
        "Selecione uma unidade de medida válida.",
      );
    }

    const unidadeMedida = UNIDADES[unidadeInformada];

    const quantidade = lerQuantidade(
      dados.quantidade,
      "a quantidade inicial",
    );

    const estoqueMinimo = lerQuantidade(
      dados.estoqueMinimo,
      "o estoque mínimo",
    );

    const exigeCultura =
      categoria === "Semente" ||
      categoria === "Produto colhido";

    let idCultura: number | null = null;

    if (exigeCultura) {
      if (
        typeof dados.idCultura !== "string" &&
        typeof dados.idCultura !== "number"
      ) {
        throw new ErroValidacao(
          "Selecione a cultura correspondente ao produto.",
        );
      }

      idCultura = Number(dados.idCultura);

      if (
        !Number.isSafeInteger(idCultura) ||
        idCultura <= 0
      ) {
        throw new ErroValidacao(
          "Selecione uma cultura válida.",
        );
      }
    } else if (
      dados.idCultura !== undefined &&
      dados.idCultura !== null &&
      dados.idCultura !== ""
    ) {
      throw new ErroValidacao(
        "O vínculo com cultura está disponível para sementes e produtos colhidos.",
      );
    }

    if (
      categoria === "Semente" &&
      !["KG", "SACA", "UNIDADE"].includes(
        unidadeInformada,
      )
    ) {
      throw new ErroValidacao(
        "Cadastre sementes em kg, sacas ou unidades.",
      );
    }

    if (
      categoria === "Produto colhido" &&
      unidadeInformada !== "KG"
    ) {
      throw new ErroValidacao(
        "O produto colhido deve ser cadastrado em kg. As colheitas informadas em toneladas serão convertidas para kg.",
      );
    }

    const produto = await prisma.$transaction(
      async (tx) => {
        if (idCultura !== null) {
          const cultura = await tx.cultura.findUnique({
            where: {
              id_cultura: idCultura,
            },
          });

          if (!cultura || !cultura.ativo) {
            throw new ErroValidacao(
              "Selecione uma cultura ativa.",
            );
          }
        }

        const produtoExistente =
          await tx.produto.findFirst({
            where: {
              nome_produto: {
                equals: nome,
                mode: "insensitive",
              },
            },
          });

        if (produtoExistente) {
          throw new ErroValidacao(
            "Já existe um produto cadastrado com esse nome.",
            409,
          );
        }

        // Preserva a compatibilidade com a API de colheitas.
        const categoriaBanco =
          categoria === "Produto colhido"
            ? "Outro"
            : categoria;

        const novoProduto = await tx.produto.create({
          data: {
            nome_produto: nome,
            categoria: categoriaBanco,
            quantidade,
            estoque_min: estoqueMinimo,
            unidade_medida: unidadeMedida,
            id_cultura: idCultura,
          },
        });

        // Registra o saldo inicial com o usuário conectado.
        if (quantidade !== "0.00") {
          await tx.move_estoque.create({
            data: {
              id_produto: novoProduto.id_produto,
              tipo_movimento: "ENTRADA",
              quantidade_move: quantidade,
              observacao:
                "Saldo inicial informado no cadastro do produto.",
              id_usuario: usuario.id_usuario,
            },
          });
        }

        return novoProduto;
      },
    );

    return Response.json(
      {
        message: "Produto cadastrado com sucesso.",
        produto,
      },
      { status: 201 },
    );
  } catch (error) {
    return responderErro(error);
  }
}