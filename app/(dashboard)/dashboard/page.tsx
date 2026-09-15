import ProductionChart from "@/app/components/productionChart";
import { prisma } from "@/app/lib/prisma";

export default async function DashboardPage() {
  const [totalAnimais, totalPlantios, totalProdutos, produtosEstoque] =
    await Promise.all([
      prisma.animal.count({
        where: {
          status_animal: "ATIVO",
        },
      }),

      prisma.plantio.count(),

      prisma.produto.count(),

      prisma.produto.findMany({
        select: {
          quantidade: true,
          estoque_min: true,
        },
      }),
    ]);

  const totalAlertas = produtosEstoque.filter((produto) => {
    return Number(produto.quantidade) <= Number(produto.estoque_min);
  }).length;

  const hoje = new Date();

  const inicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);

  const colheitas = await prisma.colheita.findMany({
    where: {
      data_colheita: {
        gte: inicioPeriodo,
      },
    },

    select: {
      data_colheita: true,
      quantidade_colheita: true,
      unidade_medida: true,
    },
  });

  const dadosProducao = Array.from(
    {
      length: 6,
    },
    (_, indice) => {
      const data = new Date(
        hoje.getFullYear(),
        hoje.getMonth() - 5 + indice,
        1,
      );

      return {
        chave: `${data.getFullYear()}-${data.getMonth()}`,
        mes: new Intl.DateTimeFormat("pt-BR", {
          month: "short",
        })
          .format(data)
          .replace(".", ""),
        producao: 0,
      };
    },
  );

  colheitas.forEach((colheita) => {
    const chave =
      `${colheita.data_colheita.getFullYear()}-` +
      `${colheita.data_colheita.getMonth()}`;

    const mes = dadosProducao.find((item) => item.chave === chave);

    if (!mes) {
      return;
    }

    const quantidade = Number(colheita.quantidade_colheita);

    const unidade = colheita.unidade_medida.toUpperCase();

    if (unidade === "KG") {
      mes.producao += quantidade;
    }

    if (unidade === "TONELADA" || unidade === "TONELADAS") {
      mes.producao += quantidade * 1000;
    }
  });

  const dadosDoGrafico = dadosProducao.map(({ mes, producao }) => ({
    mes,
    producao,
  }));

  const indicadores = [
    {
      titulo: "Total de Animais",
      valor: totalAnimais.toString(),
      descricao: "Animais ativos cadastrados",
      icone: "🐄",
      cor: "bg-green-100",
    },
    {
      titulo: "Plantios Cadastrados",
      valor: totalPlantios.toString(),
      descricao: "Registros de plantio",
      icone: "🌱",
      cor: "bg-emerald-100",
    },
    {
      titulo: "Produtos em Estoque",
      valor: totalProdutos.toString(),
      descricao: "Produtos cadastrados",
      icone: "📦",
      cor: "bg-blue-100",
    },
    {
      titulo: "Alertas",
      valor: totalAlertas.toString(),
      descricao: "Produtos abaixo do mínimo",
      icone: "⚠️",
      cor: "bg-red-100",
    },
  ];
  return (
    <div>
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
          Painel de controle
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">Dashboard</h1>

        <p className="mt-2 text-slate-500">
          Acompanhe os principais dados da sua propriedade rural.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map((indicador) => (
          <article
            key={indicador.titulo}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  {indicador.titulo}
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {indicador.valor}
                </p>
              </div>

              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${indicador.cor}`}
              >
                {indicador.icone}
              </div>
            </div>

            <p className="mt-5 border-t border-slate-100 pt-3 text-sm text-slate-500">
              {indicador.descricao}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Resumo da produção
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Produção registrada nos últimos meses
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <ProductionChart dados={dadosDoGrafico} />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Atividades recentes
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Últimas movimentações do sistema
          </p>

          <div className="mt-6 space-y-4">
            <Atividade
              icone="🐄"
              titulo="Novo animal cadastrado"
              descricao="Animal Estrela foi adicionado"
              horario="Hoje, às 09:42"
            />

            <Atividade
              icone="🌱"
              titulo="Plantio atualizado"
              descricao="Plantio de milho está em andamento"
              horario="Hoje, às 08:15"
            />

            <Atividade
              icone="📦"
              titulo="Entrada no estoque"
              descricao="Foram adicionados 320 kg de ração"
              horario="Ontem, às 16:30"
            />
          </div>
        </article>
      </section>
    </div>
  );
}

type AtividadeProps = {
  icone: string;
  titulo: string;
  descricao: string;
  horario: string;
};

function Atividade({ icone, titulo, descricao, horario }: AtividadeProps) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 pb-4 last:border-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
        {icone}
      </div>

      <div>
        <p className="font-semibold text-slate-800">{titulo}</p>
        <p className="text-sm text-slate-500">{descricao}</p>
        <p className="mt-1 text-xs text-slate-400">{horario}</p>
      </div>
    </div>
  );
}
