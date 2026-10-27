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

function responderErro(error: unknown) {
  if (error instanceof ErroAutenticacao || error instanceof ErroValidacao) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("Erro ao alterar status do animal:", error);
  return Response.json(
    { error: "Não foi possível atualizar o status do animal." },
    { status: 500 },
  );
}

export async function PATCH(request: Request) {
  try {
    await exigirProprietario();

    const dados = await request.json().catch(() => null);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroValidacao("Os dados enviados são inválidos.");
    }

    const id = Number(dados.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new ErroValidacao("Selecione um animal válido.");
    }

    if (dados.status !== "ATIVO" && dados.status !== "INATIVO") {
      throw new ErroValidacao("Selecione um status válido.");
    }

    const resultado = await prisma.$transaction(
      async (tx) => {
        // Alimentação e vacinação bloqueiam primeiro o mesmo animal.
        // A consulta posterior ao bloqueio lê o status atualizado.
        await tx.$queryRaw`
          SELECT id_animal
          FROM animal
          WHERE id_animal = ${id}
          FOR UPDATE
        `;

        const animal = await tx.animal.findUnique({
          where: { id_animal: id },
          select: { id_animal: true, status_animal: true },
        });

        if (!animal) {
          throw new ErroValidacao("Animal não encontrado.", 404);
        }

        if (animal.status_animal !== "ATIVO" && animal.status_animal !== "INATIVO") {
          throw new ErroValidacao(
            "O animal tem um status legado não reconhecido. Revise o cadastro antes de alterá-lo.",
            409,
          );
        }

        if (animal.status_animal === dados.status) {
          return { id: animal.id_animal, status: animal.status_animal, repetido: true };
        }

        await tx.animal.update({
          where: { id_animal: id },
          data: { status_animal: dados.status, atualizado_em: new Date() },
        });

        return { id: animal.id_animal, status: dados.status, repetido: false };
      },
      { isolationLevel: "ReadCommitted" },
    );

    const inativo = resultado.status === "INATIVO";
    return Response.json({
      message: resultado.repetido
        ? `Este animal já está ${inativo ? "inativo" : "ativo"}.`
        : `Animal ${inativo ? "inativado" : "reativado"} com sucesso.`,
      animal: { id_animal: resultado.id, status_animal: resultado.status },
    });
  } catch (error) {
    return responderErro(error);
  }
}
