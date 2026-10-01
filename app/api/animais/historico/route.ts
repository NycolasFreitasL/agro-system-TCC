import { prisma } from "@/app/lib/prisma";
import {
  exigirUsuario,
  ErroAutenticacao,
} from "@/app/lib/sessao";

export async function GET(request: Request) {
  try {
    await exigirUsuario();

    const url = new URL(request.url);
    const parametro = url.searchParams.get("idAnimal");

    if (!parametro || !/^\d+$/.test(parametro)) {
      return Response.json(
        { error: "Animal inválido." },
        { status: 400 },
      );
    }

    const idAnimal = Number(parametro);

    if (!Number.isSafeInteger(idAnimal) || idAnimal <= 0) {
      return Response.json(
        { error: "Animal inválido." },
        { status: 400 },
      );
    }

    const animal = await prisma.animal.findUnique({
      where: {
        id_animal: idAnimal,
      },
      select: {
        id_animal: true,
      },
    });

    if (!animal) {
      return Response.json(
        { error: "Animal não encontrado." },
        { status: 404 },
      );
    }

    const [alimentacoes, vacinacoes] = await Promise.all([
      prisma.alimentacao.findMany({
        where: {
          id_animal: idAnimal,
        },
        include: {
          produto: {
            select: {
              nome_produto: true,
              unidade_medida: true,
            },
          },
          usuarios: {
            select: {
              nome_usuario: true,
            },
          },
        },
        orderBy: [
          { data_alimentacao: "desc" },
          { id_alimentacao: "desc" },
        ],
        take: 50,
      }),

      prisma.vacinacao.findMany({
        where: {
          id_animal: idAnimal,
        },
        include: {
          produto: {
            select: {
              nome_produto: true,
            },
          },
          usuarios: {
            select: {
              nome_usuario: true,
            },
          },
        },
        orderBy: [
          { data_vacina: "desc" },
          { id_vacina: "desc" },
        ],
        take: 50,
      }),
    ]);

    const registros = [
      ...alimentacoes.map((registro) => ({
        chave: `alimentacao-${registro.id_alimentacao}`,
        tipo: "ALIMENTACAO",
        data: registro.data_alimentacao
          .toISOString()
          .slice(0, 10),
        produto: registro.produto.nome_produto,
        quantidade:
          registro.quantidade_alimentacao.toString(),
        unidade: registro.produto.unidade_medida,
        observacao: registro.observacao,
        responsavel: registro.usuarios.nome_usuario,
      })),

      ...vacinacoes.map((registro) => ({
        chave: `vacinacao-${registro.id_vacina}`,
        tipo: "VACINACAO",
        data: registro.data_vacina
          .toISOString()
          .slice(0, 10),
        produto: registro.produto.nome_produto,
        quantidade:
          registro.dose_vacina?.toString() ?? null,
        unidade: registro.unidade_dose,
        observacao: registro.observacao,
        responsavel: registro.usuarios.nome_usuario,
      })),
    ].sort(
      (a, b) =>
        b.data.localeCompare(a.data) ||
        a.chave.localeCompare(b.chave),
    );

    return Response.json(
      { registros },
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
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    console.error(
      "Erro ao consultar histórico do animal:",
      error,
    );

    return Response.json(
      {
        error:
          "Não foi possível carregar o histórico do animal.",
      },
      { status: 500 },
    );
  }
}