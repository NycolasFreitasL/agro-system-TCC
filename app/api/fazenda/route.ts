import { prisma } from "@/app/lib/prisma";
import {
  exigirProprietario,
  ErroAutenticacao,
} from "@/app/lib/sessao";

class ErroValidacao extends Error {}

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF",
  "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS",
  "RO", "RR", "SC", "SP", "SE", "TO",
];

function lerTexto(
  valor: unknown,
  campo: string,
  limite: number,
  obrigatorio = false,
): string | null {
  if (
    valor !== undefined &&
    valor !== null &&
    typeof valor !== "string"
  ) {
    throw new ErroValidacao(
      `O campo ${campo} é inválido.`,
    );
  }

  const texto =
    typeof valor === "string"
      ? valor.trim()
      : "";

  if (obrigatorio && !texto) {
    throw new ErroValidacao(
      `Preencha o campo ${campo}.`,
    );
  }

  if (texto.length > limite) {
    throw new ErroValidacao(
      `O campo ${campo} deve ter no máximo ${limite} caracteres.`,
    );
  }

  return texto || null;
}

export async function PUT(request: Request) {
  try {
    await exigirProprietario();

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

    const nome = lerTexto(
      dados.nome,
      "nome da fazenda",
      100,
      true,
    );

    const municipio = lerTexto(
      dados.municipio,
      "município",
      100,
    );

    const endereco = lerTexto(
      dados.endereco,
      "endereço",
      200,
    );

    const telefone = lerTexto(
      dados.telefone,
      "telefone",
      20,
    );

    const ufInformada = lerTexto(
      dados.uf,
      "estado",
      2,
    );

    const uf = ufInformada?.toUpperCase() ?? null;

    if (uf && !UFS.includes(uf)) {
      throw new ErroValidacao(
        "Selecione um estado válido.",
      );
    }

    if (telefone) {
      const digitos = telefone.replace(/\D/g, "");

      if (
        !/^[0-9()+\-\s]+$/.test(telefone) ||
        digitos.length < 10 ||
        digitos.length > 13
      ) {
        throw new ErroValidacao(
          "Informe um telefone com DDD ou deixe o campo vazio.",
        );
      }
    }

    const valores = {
      nome_fazenda: nome!,
      municipio,
      uf,
      endereco,
      telefone,
    };

    const fazenda = await prisma.fazenda.upsert({
      where: {
        id_fazenda: 1,
      },
      create: {
        id_fazenda: 1,
        ...valores,
      },
      update: valores,
    });

    return Response.json(
      {
        message: "Dados da fazenda salvos com sucesso.",
        fazenda: {
          nome: fazenda.nome_fazenda,
          municipio: fazenda.municipio,
          uf: fazenda.uf,
          endereco: fazenda.endereco,
          telefone: fazenda.telefone,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof ErroAutenticacao) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof ErroValidacao) {
      return Response.json(
        { error: error.message },
        { status: 400 },
      );
    }

    console.error("Erro ao salvar dados da fazenda:", error);

    return Response.json(
      {
        error: "Não foi possível salvar os dados da fazenda.",
      },
      { status: 500 },
    );
  }
}