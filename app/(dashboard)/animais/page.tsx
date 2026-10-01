import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { obterUsuarioAtual } from "@/app/lib/sessao";
import AnimaisPainel from "@/app/components/animais-painel";

export default async function AnimaisPage() {
  const usuario = await obterUsuarioAtual();

  if (!usuario) {
    redirect("/login");
  }

  const [animais, especies] = await Promise.all([
    prisma.animal.findMany({
      include: {
        especie: {
          select: {
            nome_especie: true,
          },
        },
        _count: {
          select: {
            alimentacao: true,
            vacinacao: true,
          },
        },
      },
      orderBy: [
        { criado_em: "desc" },
        { id_animal: "desc" },
      ],
    }),

    prisma.especie.findMany({
      where: {
        status: "ATIVO",
      },
      select: {
        id_especie: true,
        nome_especie: true,
      },
      orderBy: {
        nome_especie: "asc",
      },
    }),
  ]);

  return (
    <AnimaisPainel
      especies={especies}
      animais={animais.map((animal) => ({
        id: animal.id_animal,
        nome: animal.nome_animal,
        especie: animal.especie.nome_especie,
        raca: animal.raca_animal,
        sexo: animal.sexo_animal,
        nascimento:
          animal.data_nascimento
            ?.toISOString()
            .slice(0, 10) ?? null,
        peso:
          animal.peso_animal === null
            ? null
            : Number(animal.peso_animal),
        saude: animal.saude_animal,
        foto: animal.foto_animal,
        status: animal.status_animal,
        criadoEm: animal.criado_em?.toISOString() ?? null,
        alimentacoes: animal._count.alimentacao,
        vacinacoes: animal._count.vacinacao,
      }))}
    />
  );
}
