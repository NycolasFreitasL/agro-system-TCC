import { prisma } from "@/app/lib/prisma";
import PlantioModal from "@/app/components/plantiomodal";
import ColheitaModal from "@/app/components/colheitamodal";

export default async function PlantioPage() {
  const plantios = await prisma.plantio.findMany({
    include: {
      lote: true,
      produto: true,
      usuarios: true,
    },

    orderBy: {
      data_plantio: "desc",
    },
  });

  const colheitas = await prisma.colheita.findMany({
    take: 10,

    orderBy: {
      data_colheita: "desc",
    },

    include: {
      plantio: {
        include: {
          produto: true,
          lote: true,
        },
      },

      usuarios: true,
    },
  });

  const lotesDoBanco = await prisma.lote.findMany({
    where: {
      status_lote: "ATIVO",
    },

    orderBy: {
      nome_lote: "asc",
    },
  });

  const produtosDoBanco = await prisma.produto.findMany({
    where: {
      categoria: "Semente",
      cultura: {
        is: {
          ativo: true,
        },
      },
    },
    orderBy: {
      nome_produto: "asc",
    },
  });

  const lotes = lotesDoBanco.map((lote) => ({
    id_lote: lote.id_lote,
    nome_lote: lote.nome_lote,
    area: Number(lote.area),
  }));

  const produtos = produtosDoBanco.map((produto) => ({
    id_produto: produto.id_produto,
    nome_produto: produto.nome_produto,
    unidade_medida: produto.unidade_medida,
  }));

  const plantiosAtivos = plantios.filter(
    (plantio) =>
      plantio.status_plantio === "ATIVO" ||
      plantio.status_plantio === "EM ANDAMENTO",
  );

  const lotesAtivos = new Map<number, number>();

  plantiosAtivos.forEach((plantio) => {
    lotesAtivos.set(plantio.lote.id_lote, Number(plantio.lote.area));
  });

  const areaCultivada = Array.from(lotesAtivos.values()).reduce(
    (total, area) => total + area,
    0,
  );

  const hoje = new Date();

  const proximasColheitas = plantios
    .filter((plantio) => plantio.prev_colheita && plantio.prev_colheita >= hoje)
    .sort((primeiro, segundo) => {
      return (
        primeiro.prev_colheita!.getTime() - segundo.prev_colheita!.getTime()
      );
    });

  const proximaColheita = proximasColheitas[0];

  return (
    <div>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
            Agricultura
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Gestão de plantios
          </h1>

          <p className="mt-2 text-slate-500">
            Acompanhe os lotes, culturas e previsões de colheita.
          </p>
        </div>

        {/* <button className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white hover:bg-green-900">
          + Novo plantio
        </button> */}
        <PlantioModal lotes={lotes} produtos={produtos} />
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          titulo="Plantios ativos"
          valor={plantiosAtivos.length.toString()}
          descricao="Cultivos em andamento"
          icone="🌱"
        />

        <Card
          titulo="Área cultivada"
          valor={`${areaCultivada.toFixed(2)} ha`}
          descricao="Área ocupada por plantios ativos"
          icone="🌾"
        />

        <Card
          titulo="Próxima colheita"
          valor={
            proximaColheita
              ? formatarData(proximaColheita.prev_colheita!)
              : "Não prevista"
          }
          descricao={
            proximaColheita
              ? proximaColheita.produto.nome_produto
              : "Nenhuma colheita futura"
          }
          icone="📅"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">Plantios cadastrados</h2>

          <p className="mt-1 text-sm text-slate-500">
            {plantios.length} registros encontrados
          </p>
        </div>

        {plantios.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl">🌱</div>

            <h3 className="mt-4 font-bold text-slate-800">
              Nenhum plantio cadastrado
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Registre o primeiro plantio da propriedade.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Cultura</th>
                  <th className="px-5 py-3">Lote</th>
                  <th className="px-5 py-3">Área do lote</th>
                  <th className="px-5 py-3">Data do plantio</th>
                  <th className="px-5 py-3">Previsão de colheita</th>
                  <th className="px-5 py-3">Quantidade</th>
                  <th className="px-5 py-3">Responsável</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {plantios.map((plantio) => {
                  const ativo =
                    plantio.status_plantio === "ATIVO" ||
                    plantio.status_plantio === "EM ANDAMENTO";

                  return (
                    <tr key={plantio.id_plantio} className="hover:bg-green-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
                            🌱
                          </div>

                          <div>
                            <p className="font-semibold text-slate-800">
                              {plantio.produto.nome_produto}
                            </p>

                            <p className="text-xs text-slate-400">
                              Plantio #{plantio.id_plantio}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-700">
                        {plantio.lote.nome_lote}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {Number(plantio.lote.area).toFixed(2)} ha
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatarData(plantio.data_plantio)}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {plantio.prev_colheita
                          ? formatarData(plantio.prev_colheita)
                          : "Não informada"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {Number(plantio.quantidade_plantada).toFixed(2)}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {plantio.usuarios.nome_usuario}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            ativo
                              ? "rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                              : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                          }
                        >
                          {plantio.status_plantio}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {/*<button className="font-semibold text-green-700 hover:text-green-900">
                          Gerenciar
                        </button>*/}
                        <ColheitaModal
                          idPlantio={plantio.id_plantio}
                          nomeCultura={plantio.produto.nome_produto}
                          nomeLote={plantio.lote.nome_lote}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">Colheitas recentes</h2>

          <p className="mt-1 text-sm text-slate-500">
            Últimas produções registradas
          </p>
        </div>

        {colheitas.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-5xl">🌾</p>

            <h3 className="mt-4 font-bold text-slate-800">
              Nenhuma colheita registrada
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              As colheitas aparecerão aqui após o registro.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Cultura</th>
                  <th className="px-5 py-3">Lote</th>
                  <th className="px-5 py-3">Quantidade</th>
                  <th className="px-5 py-3">Responsável</th>
                  <th className="px-5 py-3">Observação</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {colheitas.map((colheita) => (
                  <tr key={colheita.id_colheita} className="hover:bg-green-50">
                    <td className="px-5 py-4 text-slate-600">
                      {formatarData(colheita.data_colheita)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-100">
                          🌾
                        </div>

                        <div>
                          <p className="font-semibold text-slate-800">
                            {colheita.plantio.produto.nome_produto}
                          </p>

                          <p className="text-xs text-slate-400">
                            Colheita #{colheita.id_colheita}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {colheita.plantio.lote.nome_lote}
                    </td>

                    <td className="px-5 py-4">
                      <strong className="text-green-700">
                        {Number(colheita.quantidade_colheita).toFixed(2)}
                      </strong>

                      <span className="ml-1 text-xs text-slate-400">
                        {colheita.unidade_medida}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {colheita.usuarios.nome_usuario}
                    </td>

                    <td className="max-w-64 truncate px-5 py-4 text-slate-500">
                      {colheita.observacao || "Sem observação"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatarData(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(data);
}

type CardProps = {
  titulo: string;
  valor: string;
  descricao: string;
  icone: string;
};

function Card({ titulo, valor, descricao, icone }: CardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{titulo}</p>

          <p className="mt-2 text-2xl font-bold text-slate-900">{valor}</p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100 text-xl">
          {icone}
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500">{descricao}</p>
    </article>
  );
}
