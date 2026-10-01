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

function lerId(valor: unknown) {
  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao("Espécie inválida.");
  }

  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ErroValidacao("Espécie inválida.");
  }

  return id;
}

async function lerDados(request: Request) {
  const dados = await request.json().catch(() => null);

  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados)
  ) {
    throw new ErroValidacao(
      "Os dados enviados são inválidos.",
    );
  }

  return dados;
}

function lerNome(valor: unknown) {
  const nome =
    typeof valor === "string" ? valor.trim() : "";

  if (!nome || nome.length > 60) {
    throw new ErroValidacao(
      "Informe um nome com até 60 caracteres.",
    );
  }

  return nome;
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

  // A chave estrangeira também impede excluir uma espécie
  // que tenha recebido um animal durante a operação.
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2003"
  ) {
    return Response.json(
      {
        error:
          "Esta espécie possui animais vinculados. Desative-a para preservar o histórico.",
      },
      { status: 409 },
    );
  }

  console.error("Erro na gestão de espécies:", error);

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

    await prisma.$transaction(async (tx) => {
      // Evita nomes duplicados em cadastros e edições simultâneos.
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(73142, 2)::text AS bloqueio
      `;

      const existente = await tx.especie.findFirst({
        where: {
          nome_especie: {
            equals: nome,
            mode: "insensitive",
          },
        },
        select: {
          id_especie: true,
        },
      });

      if (existente) {
        throw new ErroValidacao(
          "Já existe uma espécie com esse nome.",
          409,
        );
      }

      await tx.especie.create({
        data: {
          nome_especie: nome,
          status: "ATIVO",
        },
      });
    });

    return Response.json(
      { message: "Espécie cadastrada com sucesso." },
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
    const status = lerStatus(dados.status);

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(73142, 2)::text AS bloqueio
      `;

      await tx.$queryRaw`
        SELECT id_especie
        FROM especie
        WHERE id_especie = ${id}
        FOR UPDATE
      `;

      const especie = await tx.especie.findUnique({
        where: {
          id_especie: id,
        },
      });

      if (!especie) {
        throw new ErroValidacao(
          "Espécie não encontrada.",
          404,
        );
      }

      const nomeExistente = await tx.especie.findFirst({
        where: {
          id_especie: {
            not: id,
          },
          nome_especie: {
            equals: nome,
            mode: "insensitive",
          },
        },
        select: {
          id_especie: true,
        },
      });

      if (nomeExistente) {
        throw new ErroValidacao(
          "Já existe outra espécie com esse nome.",
          409,
        );
      }

      await tx.especie.update({
        where: {
          id_especie: id,
        },
        data: {
          nome_especie: nome,
          status,
          atualizado_em: new Date(),
        },
      });
    });

    return Response.json({
      message: "Espécie atualizada com sucesso.",
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
        SELECT pg_advisory_xact_lock(73142, 2)::text AS bloqueio
      `;

      await tx.$queryRaw`
        SELECT id_especie
        FROM especie
        WHERE id_especie = ${id}
        FOR UPDATE
      `;

      const especie = await tx.especie.findUnique({
        where: {
          id_especie: id,
        },
      });

      if (!especie) {
        throw new ErroValidacao(
          "Espécie não encontrada.",
          404,
        );
      }

      const animais = await tx.animal.count({
        where: {
          id_especie: id,
        },
      });

      if (animais > 0) {
        throw new ErroValidacao(
          "Esta espécie possui animais vinculados. Desative-a para preservar o histórico.",
          409,
        );
      }

      await tx.especie.delete({
        where: {
          id_especie: id,
        },
      });
    });

    return Response.json({
      message: "Espécie excluída com sucesso.",
    });
  } catch (error) {
    return responderErro(error);
  }
}