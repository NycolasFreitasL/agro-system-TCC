import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { obterUsuarioAtual } from "@/app/lib/sessao";

import FazendaFormulario from "@/app/components/fazenda-formulario";
import FazendaEspecies from "@/app/components/fazenda-especies";
import FazendaLotes from "@/app/components/fazenda-lotes";

export default async function FazendaPage() {
  const usuario = await obterUsuarioAtual();

  if (!usuario) {
    redirect("/login");
  }

  if (usuario.permissao_usuario !== "PROPRIETARIO") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-bold text-[#244b49]">
          Acesso restrito
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Somente o proprietário pode administrar os dados da fazenda.
        </p>
      </section>
    );
  }

  const [fazenda, especies, lotes] = await Promise.all([
    prisma.fazenda.findUnique({
      where: {
        id_fazenda: 1,
      },
    }),

    prisma.especie.findMany({
      include: {
        _count: {
          select: {
            animal: true,
          },
        },
      },
      orderBy: {
        nome_especie: "asc",
      },
    }),

    prisma.lote.findMany({
      include: {
        _count: {
          select: {
            plantio: true,
          },
        },
        plantio: {
          where: {
            status_plantio: {
              in: ["ATIVO", "EM ANDAMENTO"],
            },
          },
          select: {
            area_plantada: true,
          },
        },
      },
      orderBy: {
        nome_lote: "asc",
      },
    }),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#486d6b]/10 text-[#486d6b]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="m3 10 9-7 9 7M5 9v12h14V9" />
            <path d="M9 21v-8h6v8M3 21h18" />
          </svg>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#486d6b]">
            Administração
          </p>

          <h1 className="mt-1 text-3xl font-bold text-[#244b49]">
            Fazenda
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Gerencie a propriedade, os lotes agrícolas e as espécies.
          </p>
        </div>
      </header>

      <FazendaFormulario
        fazenda={
          fazenda
            ? {
                nome: fazenda.nome_fazenda,
                municipio: fazenda.municipio,
                uf: fazenda.uf,
                endereco: fazenda.endereco,
                telefone: fazenda.telefone,
              }
            : null
        }
      />

      <FazendaLotes
        lotes={lotes.map((lote) => {
          const possuiAreaDesconhecida = lote.plantio.some(
            (plantio) => plantio.area_plantada === null,
          );

          const areaOcupadaCentesimos = lote.plantio.reduce(
            (total, plantio) =>
              total +
              Math.round(
                Number(plantio.area_plantada ?? 0) * 100,
              ),
            0,
          );

          return {
            id: lote.id_lote,
            nome: lote.nome_lote,
            area: lote.area.toFixed(2),
            status: lote.status_lote,
            totalPlantios: lote._count.plantio,
            plantiosAtivos: lote.plantio.length,
            areaOcupada: possuiAreaDesconhecida
              ? null
              : areaOcupadaCentesimos / 100,
          };
        })}
      />

      <FazendaEspecies
        especies={especies.map((especie) => ({
          id: especie.id_especie,
          nome: especie.nome_especie,
          status: especie.status,
          animais: especie._count.animal,
        }))}
      />
    </div>
  );
}
