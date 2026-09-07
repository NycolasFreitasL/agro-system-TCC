import { prisma } from "@/app/lib/prisma";

export async function POST(request: Request) {
  try {
    const dados = await request.json();

    const nome =
      typeof dados.nome === "string"
        ? dados.nome.trim()
        : "";

    const idEspecie = Number(dados.especie);

    if (!nome || !idEspecie || !dados.sexo) {
      return Response.json(
        {
          error: "Nome, espécie e sexo são obrigatórios.",
        },
        {
          status: 400,
        },
      );
    }

    const animal = await prisma.animal.create({
      data: {
        nome_animal: nome,
        id_especie: idEspecie,

        raca_animal:
          typeof dados.raca === "string" &&
          dados.raca.trim()
            ? dados.raca.trim()
            : null,

        sexo_animal: dados.sexo,

        data_nascimento: dados.nascimento
          ? new Date(`${dados.nascimento}T12:00:00`)
          : null,

        peso_animal: dados.peso
          ? String(dados.peso)
          : null,

        saude_animal:
          dados.saude || "SAUDÁVEL",

        status_animal: "ATIVO",
      },
      include: {
        especie: true,
      },
    });

    return Response.json(
      {
        message: "Animal cadastrado com sucesso.",
        animal,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Erro ao cadastrar animal:", error);

    return Response.json(
      {
        error: "Não foi possível cadastrar o animal.",
      },
      {
        status: 500,
      },
    );
  }
}