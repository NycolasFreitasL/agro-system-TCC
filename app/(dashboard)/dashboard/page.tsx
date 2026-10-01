import Link from "next/link";
import { redirect } from "next/navigation";

import ProductionChart from "@/app/components/productionChart";
import { prisma } from "@/app/lib/prisma";
import { obterUsuarioAtual } from "@/app/lib/sessao";

type IconeNome = "animais" | "cultivo" | "estoque" | "alerta";

const numero = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function obterHoje() {
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

export default async function DashboardPage() {
  const usuario = await obterUsuarioAtual();

  if (!usuario) {
    redirect("/login");
  }

  const hoje = obterHoje();
  const [ano, mes] = hoje.split("-").map(Number);

  // As colheitas usam uma coluna DATE.
  // Agrupamos pelo mês da data registrada, sem conversão de fuso.
  const inicioPeriodo = new Date(Date.UTC(ano, mes - 6, 1));

  const fimPeriodo = new Date(`${hoje}T00:00:00.000Z`);
  fimPeriodo.setUTCDate(fimPeriodo.getUTCDate() + 1);

  const [
    totalAnimais,
    totalPlantiosAtivos,
    produtos,
    colheitas,
    movimentacoes,
  ] = await Promise.all([
    prisma.animal.count({
      where: {
        status_animal: "ATIVO",
      },
    }),

    prisma.plantio.count({
      where: {
        status_plantio: {
          in: ["ATIVO", "EM ANDAMENTO"],
        },
      },
    }),

    prisma.produto.findMany({
      select: {
        id_produto: true,
        nome_produto: true,
        quantidade: true,
        estoque_min: true,
        unidade_medida: true,
      },
      orderBy: {
        nome_produto: "asc",
      },
    }),

    prisma.colheita.findMany({
      where: {
        data_colheita: {
          gte: inicioPeriodo,
          lt: fimPeriodo,
        },
      },
      select: {
        data_colheita: true,
        quantidade_colheita: true,
        unidade_medida: true,
      },
    }),

    prisma.move_estoque.findMany({
      take: 5,
      orderBy: [
        { data_movimentacao: "desc" },
        { id_movimentacao: "desc" },
      ],
      select: {
        id_movimentacao: true,
        tipo_movimento: true,
        quantidade_move: true,
        data_movimentacao: true,
        observacao: true,
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
    }),
  ]);

  const produtosComSaldo = produtos.filter(
    (produto) => Number(produto.quantidade) > 0,
  ).length;

  const alertas = produtos
    .filter(
      (produto) =>
        Number(produto.quantidade) <= Number(produto.estoque_min),
    )
    .sort((a, b) => {
      // Produtos sem saldo aparecem primeiro.
      const prioridadeA = Number(a.quantidade) <= 0 ? 0 : 1;
      const prioridadeB = Number(b.quantidade) <= 0 ? 0 : 1;

      return (
        prioridadeA - prioridadeB ||
        a.nome_produto.localeCompare(b.nome_produto, "pt-BR")
      );
    });

  const dadosMensais = Array.from({ length: 6 }, (_, indice) => {
    const data = new Date(Date.UTC(ano, mes - 6 + indice, 1));

    const nomeMes = new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      timeZone: "UTC",
    })
      .format(data)
      .replace(".", "");

    return {
      chave: data.toISOString().slice(0, 7),
      mes: `${nomeMes}/${String(data.getUTCFullYear()).slice(-2)}`,
      centesimos: 0,
    };
  });

  let registrosNaoConvertidos = 0;

  for (const colheita of colheitas) {
    const chave = colheita.data_colheita.toISOString().slice(0, 7);
    const mesCorrespondente = dadosMensais.find(
      (item) => item.chave === chave,
    );

    if (!mesCorrespondente) continue;

    const unidade = colheita.unidade_medida.trim().toUpperCase();

    const fator =
      unidade === "KG"
        ? 1
        : unidade === "TONELADA" || unidade === "TONELADAS"
          ? 1000
          : null;

    if (fator === null) {
      registrosNaoConvertidos++;
      continue;
    }

    // Soma em centésimos para reduzir erros de arredondamento.
    const centesimos = Math.round(
      Number(colheita.quantidade_colheita) * 100,
    );

    mesCorrespondente.centesimos += centesimos * fator;
  }

  const dadosDoGrafico = dadosMensais.map((item) => ({
    mes: item.mes,
    producao: item.centesimos / 100,
  }));

  const totalProducao =
    dadosMensais.reduce((soma, item) => soma + item.centesimos, 0) / 100;

  const indicadores: {
    titulo: string;
    valor: number;
    descricao: string;
    icone: IconeNome;
    href: string;
  }[] = [
    {
      titulo: "Animais ativos",
      valor: totalAnimais,
      descricao: "Animais com cadastro ativo",
      icone: "animais",
      href: "/animais",
    },
    {
      titulo: "Cultivos ativos",
      valor: totalPlantiosAtivos,
      descricao: "Plantios ativos ou em andamento",
      icone: "cultivo",
      href: "/plantio",
    },
    {
      titulo: "Produtos com saldo",
      valor: produtosComSaldo,
      descricao: `${produtos.length} produtos cadastrados no total`,
      icone: "estoque",
      href: "/estoque",
    },
    {
      titulo: "Alertas de estoque",
      valor: alertas.length,
      descricao: "Produtos no mínimo ou abaixo",
      icone: "alerta",
      href: "/estoque",
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl">
      <header className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#486d6b]">
          Visão geral
        </p>

        <h1 className="mt-2 text-2xl font-bold text-[#244b49] sm:text-3xl">
          Dashboard
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Acompanhe os animais, os cultivos e o estoque da propriedade.
        </p>
      </header>

      <section
        aria-label="Indicadores da propriedade"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {indicadores.map((indicador) => (
          <Link
            key={indicador.titulo}
            href={indicador.href}
            className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#486d6b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#486d6b]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-medium text-slate-500">
                  {indicador.titulo}
                </h2>

                <p className="mt-3 break-words text-3xl font-bold text-[#244b49]">
                  {numero.format(indicador.valor)}
                </p>
              </div>

              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  indicador.icone === "alerta" && alertas.length > 0
                    ? "bg-amber-50 text-amber-700"
                    : "bg-[#e8f0ef] text-[#486d6b]"
                }`}
              >
                <Icone nome={indicador.icone} />
              </span>
            </div>

            <p className="mt-5 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
              {indicador.descricao}
            </p>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#244b49]">
                Colheitas por mês
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Últimos seis meses, incluindo o mês atual.
              </p>
            </div>

            <Link
              href="/plantio"
              className="text-sm font-semibold text-[#486d6b] hover:underline"
            >
              Ver cultivos
            </Link>
          </div>

          <p className="mt-5 break-words text-2xl font-bold text-[#244b49]">
            {numero.format(totalProducao)} kg
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Total registrado no período até hoje.
          </p>

          <div className="mt-5 min-w-0">
            <ProductionChart dados={dadosDoGrafico} />
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Soma das colheitas de todas as culturas.
            Quantidades em toneladas são convertidas para kg.
          </p>

          {registrosNaoConvertidos > 0 && (
            <p
              role="status"
              className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800"
            >
              {registrosNaoConvertidos} registro(s) não foram incluídos
              porque a unidade não é kg ou tonelada.
            </p>
          )}
        </article>

        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#244b49]">
                Movimentações recentes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Últimos cinco registros do estoque.
              </p>
            </div>

            <Link
              href="/estoque"
              className="text-sm font-semibold text-[#486d6b] hover:underline"
            >
              Ver estoque
            </Link>
          </div>

          {movimentacoes.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              Nenhuma movimentação registrada.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-slate-100">
              {movimentacoes.map((movimentacao) => {
                const entrada =
                  movimentacao.tipo_movimento === "ENTRADA";

                const saida =
                  movimentacao.tipo_movimento === "SAIDA";

                const titulo = entrada
                  ? "Entrada no estoque"
                  : saida
                    ? "Saída do estoque"
                    : movimentacao.tipo_movimento;

                return (
                  <li
                    key={movimentacao.id_movimentacao}
                    className="flex items-start gap-3 py-4"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        entrada
                          ? "bg-[#e8f0ef] text-[#486d6b]"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icone nome="estoque" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {titulo}
                      </p>

                      <p className="mt-1 break-words text-sm text-slate-600">
                        {movimentacao.produto.nome_produto}
                        {" · "}
                        {numero.format(
                          Number(movimentacao.quantidade_move),
                        )}{" "}
                        {movimentacao.produto.unidade_medida}
                      </p>

                      {movimentacao.observacao && (
                        <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                          {movimentacao.observacao}
                        </p>
                      )}

                      <p className="mt-2 break-words text-xs leading-5 text-slate-500">
                        {dataHora.format(movimentacao.data_movimentacao)}
                        {" · "}
                        {movimentacao.usuarios.nome_usuario}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#244b49]">
              Estoque que precisa de atenção
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Produtos com saldo igual ou inferior ao mínimo cadastrado.
            </p>
          </div>

          <Link
            href="/estoque"
            className="text-sm font-semibold text-[#486d6b] hover:underline"
          >
            Gerenciar estoque
          </Link>
        </div>

        {alertas.length === 0 ? (
          <p className="mt-5 rounded-xl bg-[#edf4f3] p-4 text-sm text-[#244b49]">
            Nenhum produto está no mínimo ou abaixo dele.
          </p>
        ) : (
          <>
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {alertas.slice(0, 6).map((produto) => (
                <li
                  key={produto.id_produto}
                  className="flex min-w-0 items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-4"
                >
                  <span className="mt-0.5 shrink-0 text-amber-700">
                    <Icone nome="alerta" />
                  </span>

                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-800">
                      {produto.nome_produto}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Saldo: {numero.format(Number(produto.quantidade))}{" "}
                      {produto.unidade_medida}
                      {" · "}
                      Mínimo: {numero.format(Number(produto.estoque_min))}{" "}
                      {produto.unidade_medida}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {alertas.length > 6 && (
              <p className="mt-4 text-xs text-slate-500">
                Exibindo 6 de {alertas.length} produtos em alerta.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Icone({ nome }: { nome: IconeNome }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {nome === "animais" && (
        <>
          <path d="M7 8 3 5v6l4 2M17 8l4-3v6l-4 2" />
          <path d="M7 8c2-2 8-2 10 0v9c0 3-10 3-10 0V8Z" />
          <path d="M8 7 6 3M16 7l2-4" />
          <path d="M9 12h.01M15 12h.01" />
          <rect x="8" y="15" width="8" height="5" rx="2" />
        </>
      )}

      {nome === "cultivo" && (
        <>
          <path d="M12 21v-9" />
          <path d="M12 14C5 14 3 10 3 5c6 0 9 3 9 9Z" />
          <path d="M12 11c0-6 3-9 9-9 0 6-3 9-9 9Z" />
          <path d="M6 21h12" />
        </>
      )}

      {nome === "estoque" && (
        <>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="M3 8v9l9 5 9-5V8M12 13v9" />
          <path d="m7.5 5.5 9 5" />
        </>
      )}

      {nome === "alerta" && (
        <>
          <path d="m12 3 10 18H2L12 3Z" />
          <path d="M12 9v5M12 17h.01" />
        </>
      )}
    </svg>
  );
}