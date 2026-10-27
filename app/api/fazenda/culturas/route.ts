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

type DadosCultura = {
  nome_cultura: string;
  dias_germinacao_min: number;
  dias_germinacao_max: number;
  ciclo_dias_min: number;
  ciclo_dias_max: number;
  produtividade_min_kg_ha: string;
  produtividade_max_kg_ha: string;
  ativo: boolean;
};

async function lerDados(request: Request): Promise<Record<string, unknown>> {
  const dados = await request.json().catch(() => null);

  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw new ErroValidacao("Os dados enviados são inválidos.");
  }

  return dados as Record<string, unknown>;
}

function lerId(valor: unknown) {
  if (
    (typeof valor !== "string" && typeof valor !== "number") ||
    !/^\d+$/.test(String(valor))
  ) {
    throw new ErroValidacao("Cultura inválida.");
  }

  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ErroValidacao("Cultura inválida.");
  }

  return id;
}

function lerNome(valor: unknown) {
  const nome = typeof valor === "string" ? valor.trim() : "";

  if (!nome || nome.length > 100) {
    throw new ErroValidacao("O nome deve ter entre 1 e 100 caracteres.");
  }

  return nome;
}

function lerDias(valor: unknown, campo: string) {
  const texto = String(valor ?? "").trim();

  if (!/^\d{1,10}$/.test(texto)) {
    throw new ErroValidacao(`${campo} deve ser um número inteiro positivo.`);
  }

  const numero = Number(texto);

  if (!Number.isSafeInteger(numero) || numero < 1 || numero > 2_147_483_647) {
    throw new ErroValidacao(`${campo} deve estar entre 1 e 2.147.483.647 dias.`);
  }

  return numero;
}

function lerProdutividade(valor: unknown, campo: string) {
  if (typeof valor !== "string" && typeof valor !== "number") {
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

function lerCultura(dados: Record<string, unknown>, permitirAtivoOpcional = false): DadosCultura {
  const nome_cultura = lerNome(dados.nome_cultura ?? dados.nome);
  const dias_germinacao_min = lerDias(
    dados.dias_germinacao_min,
    "A germinação mínima",
  );
  const dias_germinacao_max = lerDias(
    dados.dias_germinacao_max,
    "A germinação máxima",
  );
  const ciclo_dias_min = lerDias(dados.ciclo_dias_min, "O ciclo mínimo");
  const ciclo_dias_max = lerDias(dados.ciclo_dias_max, "O ciclo máximo");
  const produtividade_min_kg_ha = lerProdutividade(
    dados.produtividade_min_kg_ha,
    "a produtividade mínima",
  );
  const produtividade_max_kg_ha = lerProdutividade(
    dados.produtividade_max_kg_ha,
    "a produtividade máxima",
  );

  if (dias_germinacao_min > dias_germinacao_max) {
    throw new ErroValidacao("A germinação mínima não pode superar a máxima.");
  }
  if (ciclo_dias_min > ciclo_dias_max) {
    throw new ErroValidacao("O ciclo mínimo não pode superar o máximo.");
  }
  if (Number(produtividade_min_kg_ha) > Number(produtividade_max_kg_ha)) {
    throw new ErroValidacao("A produtividade mínima não pode superar a máxima.");
  }

  const ativo = dados.ativo === undefined && permitirAtivoOpcional
    ? true
    : dados.ativo;
  if (typeof ativo !== "boolean") {
    throw new ErroValidacao("Selecione um estado válido para a cultura.");
  }

  return {
    nome_cultura,
    dias_germinacao_min,
    dias_germinacao_max,
    ciclo_dias_min,
    ciclo_dias_max,
    produtividade_min_kg_ha,
    produtividade_max_kg_ha,
    ativo,
  };
}

function responderErro(error: unknown) {
  if (error instanceof ErroAutenticacao || error instanceof ErroValidacao) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return Response.json(
      { error: "Já existe uma cultura cadastrada com esse nome." },
      { status: 409 },
    );
  }

  console.error("Erro na gestão de culturas:", error);
  return Response.json(
    { error: "Não foi possível concluir a operação." },
    { status: 500 },
  );
}

export async function GET() {
  try {
    await exigirProprietario();
    const culturas = await prisma.cultura.findMany({
      include: {
        _count: {
          select: { produto: true, plantio: true },
        },
      },
      orderBy: { nome_cultura: "asc" },
    });

    return Response.json(
      { culturas },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return responderErro(error);
  }
}

export async function POST(request: Request) {
  try {
    await exigirProprietario();
    const cultura = lerCultura(await lerDados(request), true);

    const criada = await prisma.$transaction(
      async (tx) => {
        // O bloqueio serializa cadastros e renomeações feitos pela aplicação.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(73142, 6)::text AS bloqueio`;

        const existente = await tx.cultura.findFirst({
          where: {
            nome_cultura: { equals: cultura.nome_cultura, mode: "insensitive" },
          },
          select: { id_cultura: true },
        });

        if (existente) {
          throw new ErroValidacao(
            "Já existe uma cultura cadastrada com esse nome.",
            409,
          );
        }

        return tx.cultura.create({ data: cultura });
      },
      { isolationLevel: "ReadCommitted" },
    );

    return Response.json(
      { message: "Cultura cadastrada com sucesso.", cultura: criada },
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
    const id = lerId(dados.id ?? dados.id_cultura);
    const cultura = lerCultura(dados);

    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(73142, 6)::text AS bloqueio`;

        const atual = await tx.cultura.findUnique({
          where: { id_cultura: id },
          select: { id_cultura: true },
        });
        if (!atual) {
          throw new ErroValidacao("Cultura não encontrada.", 404);
        }

        const existente = await tx.cultura.findFirst({
          where: {
            id_cultura: { not: id },
            nome_cultura: { equals: cultura.nome_cultura, mode: "insensitive" },
          },
          select: { id_cultura: true },
        });
        if (existente) {
          throw new ErroValidacao(
            "Já existe outra cultura cadastrada com esse nome.",
            409,
          );
        }

        await tx.cultura.update({
          where: { id_cultura: id },
          data: { ...cultura, atualizado_em: new Date() },
        });
      },
      { isolationLevel: "ReadCommitted" },
    );

    return Response.json({ message: "Cultura atualizada com sucesso." });
  } catch (error) {
    return responderErro(error);
  }
}
