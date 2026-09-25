import { prisma } from "@/app/lib/prisma";
import PlantioModal from "@/app/components/plantiomodal";
import ColheitaModal from "@/app/components/colheitamodal";
import CultivoPainel, {
  DetalhesCultivo,
} from "@/app/components/cultivopainel";

const DIA = 24 * 60 * 60 * 1000;

function estaAtivo(status: string) {
  return status === "ATIVO" || status === "EM ANDAMENTO";
}

function numero(valor: number) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dataFormatada(data: Date | null) {
  if (!data) return "Não informada";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
  }).format(data);
}

function diaCalendario(data: Date) {
  return Math.floor(
    Date.UTC(
      data.getUTCFullYear(),
      data.getUTCMonth(),
      data.getUTCDate(),
    ) / DIA,
  );
}

function progressoDoCiclo(
  inicio: Date,
  previsao: Date | null,
  hoje: number,
) {
  if (!previsao) return null;

  const primeiroDia = diaCalendario(inicio);
  const ultimoDia = diaCalendario(previsao);
  const duracao = ultimoDia - primeiroDia;

  if (duracao <= 0) return null;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(((hoje - primeiroDia) / duracao) * 100),
    ),
  );
}

type Evento = {
  chave: string;
  idPlantio: number;
  cultura: string;
  lote: string;
  tipo: string;
  data: Date;
  quantidade: number;
  unidade: string;
  observacao: string | null;
};

export default async function PlantioPage() {
  const [plantios, lotesBanco, sementesBanco] =
    await Promise.all([
      prisma.plantio.findMany({
        include: {
          cultura: true,
          produto: true,
          lote: true,
          usuarios: true,
          colheita: true,
          irrigacao: true,
          fertilizacao: {
            include: {
              produto: true,
            },
          },
        },
        orderBy: [
          { data_plantio: "desc" },
          { id_plantio: "desc" },
        ],
      }),

      prisma.lote.findMany({
        orderBy: {
          nome_lote: "asc",
        },
      }),

      prisma.produto.findMany({
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
      }),
    ]);

  type Plantio = (typeof plantios)[number];

  const ativos = plantios.filter((plantio) =>
    estaAtivo(plantio.status_plantio),
  );

  const encerrados = plantios.filter(
    (plantio) => !estaAtivo(plantio.status_plantio),
  );

  const lotes = lotesBanco
    .filter((lote) => lote.status_lote === "ATIVO")
    .map((lote) => ({
      id_lote: lote.id_lote,
      nome_lote: lote.nome_lote,
      area: Number(lote.area),
    }));

  const produtos = sementesBanco.map((semente) => ({
    id_produto: semente.id_produto,
    nome_produto: semente.nome_produto,
    unidade_medida: semente.unidade_medida,
  }));

  const areaCultivada = ativos.reduce(
    (total, plantio) =>
      total + Number(plantio.area_plantada ?? 0),
    0,
  );

  const areasPendentes = ativos.filter(
    (plantio) => plantio.area_plantada === null,
  ).length;

  // Dia atual da propriedade, considerando o horário de Brasília.
  const partesHoje = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const parte = (tipo: string) =>
    partesHoje.find((item) => item.type === tipo)!.value;

  const hojeTexto =
    `${parte("year")}-${parte("month")}-${parte("day")}`;

  const hoje = diaCalendario(
    new Date(`${hojeTexto}T12:00:00.000Z`),
  );

  const previsoes = ativos
    .filter(
      (plantio) =>
        plantio.prev_colheita !== null &&
        diaCalendario(plantio.prev_colheita) >= hoje,
    )
    .sort(
      (a, b) =>
        a.prev_colheita!.getTime() -
        b.prev_colheita!.getTime(),
    );

  const proximaColheita = previsoes[0];

  const eventos: Evento[] = plantios
    .flatMap((plantio) => {
      const base = {
        idPlantio: plantio.id_plantio,
        cultura:
          plantio.cultura?.nome_cultura ??
          plantio.produto.nome_produto,
        lote: plantio.lote.nome_lote,
      };

      return [
        ...plantio.colheita.map((registro) => ({
          ...base,
          chave: `colheita-${registro.id_colheita}`,
          tipo: "Colheita",
          data: registro.data_colheita,
          quantidade: Number(registro.quantidade_colheita),
          unidade: registro.unidade_medida,
          observacao: registro.observacao,
        })),

        ...plantio.irrigacao.map((registro) => ({
          ...base,
          chave: `irrigacao-${registro.id_irrigacao}`,
          tipo: "Irrigação",
          data: registro.data_irrigacao,
          quantidade: Number(registro.quantidade_agua),
          unidade: registro.unidade_medida,
          observacao: registro.observacao,
        })),

        ...plantio.fertilizacao.map((registro) => ({
          ...base,
          chave: `fertilizacao-${registro.id_fertilizacao}`,
          tipo: "Fertilização",
          data: registro.data_fertilizacao,
          quantidade: Number(
            registro.quantidade_fertilizacao,
          ),
          unidade: registro.produto.unidade_medida,
          observacao: registro.observacao,
        })),
      ];
    })
    .sort((a, b) => b.data.getTime() - a.data.getTime());

  const colheitasNoMes = eventos.filter(
    (evento) =>
      evento.tipo === "Colheita" &&
      evento.data.toISOString().slice(0, 7) ===
        hojeTexto.slice(0, 7) &&
      diaCalendario(evento.data) <= hoje,
  ).length;

  function cardPlantio(plantio: Plantio) {
    const nome =
      plantio.cultura?.nome_cultura ??
      plantio.produto.nome_produto;

    const progresso = progressoDoCiclo(
      plantio.data_plantio,
      plantio.prev_colheita,
      hoje,
    );

    const registros = eventos.filter(
      (evento) => evento.idPlantio === plantio.id_plantio,
    );

    const previsaoAtingida =
      plantio.prev_colheita !== null &&
      diaCalendario(plantio.prev_colheita) <= hoje;

    return (
      <article
        key={plantio.id_plantio}
        className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-bold text-[#244b49]">
              {nome}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Plantio #{plantio.id_plantio}
            </p>
          </div>

          <span className="max-w-[45%] break-words text-right text-sm text-slate-500">
            {plantio.lote.nome_lote}
          </span>
        </div>

        <div className="mb-5">
          <div className="mb-2 flex justify-between gap-2 text-xs">
            <span className="font-medium text-slate-600">
              Tempo do ciclo previsto
            </span>
            <strong className="text-[#244b49]">
              {progresso === null ? "Sem previsão" : `${progresso}%`}
            </strong>
          </div>

          <div
            role={progresso !== null ? "progressbar" : undefined}
            aria-label="Tempo transcorrido do ciclo previsto"
            aria-valuemin={progresso !== null ? 0 : undefined}
            aria-valuemax={progresso !== null ? 100 : undefined}
            aria-valuenow={progresso ?? undefined}
            className="h-2 overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className="h-full rounded-full bg-[#486d6b]"
              style={{ width: `${progresso ?? 0}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Estimativa pelas datas cadastradas.
          </p>
        </div>

        <dl className="space-y-3 text-sm">
          <Info
            titulo="Área plantada"
            valor={
              plantio.area_plantada === null
                ? "Não informada"
                : `${numero(Number(plantio.area_plantada))} ha`
            }
          />
          <Info
            titulo="Data do plantio"
            valor={dataFormatada(plantio.data_plantio)}
          />
          <Info
            titulo="Colheita prevista"
            valor={dataFormatada(plantio.prev_colheita)}
          />
          <Info titulo="Status" valor={plantio.status_plantio} />
        </dl>

        {previsaoAtingida && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            A data prevista de colheita foi atingida.
            Confira a situação do cultivo.
          </p>
        )}

        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
          <DetalhesCultivo
            titulo={`${nome} — Plantio #${plantio.id_plantio}`}
          >
            <dl className="space-y-3 text-sm">
              <Info titulo="Lote" valor={plantio.lote.nome_lote} />
              <Info
                titulo="Semente"
                valor={plantio.produto.nome_produto}
              />
              <Info
                titulo="Área plantada"
                valor={
                  plantio.area_plantada === null
                    ? "Não informada"
                    : `${numero(Number(plantio.area_plantada))} ha`
                }
              />
              <Info
                titulo="Sementes utilizadas"
                valor={`${numero(Number(plantio.quantidade_plantada))} ${
                  plantio.unidade_plantada ??
                  plantio.produto.unidade_medida
                }`}
              />
              <Info
                titulo="Plantio"
                valor={dataFormatada(plantio.data_plantio)}
              />
              <Info
                titulo="Germinação prevista"
                valor={dataFormatada(plantio.prev_germinacao)}
              />
              <Info
                titulo="Colheita prevista"
                valor={dataFormatada(plantio.prev_colheita)}
              />
              <Info
                titulo="Responsável"
                valor={plantio.usuarios.nome_usuario}
              />
            </dl>

            <h3 className="mb-3 mt-6 font-bold">
              Registros do cultivo
            </h3>

            <ListaEventos eventos={registros} />
          </DetalhesCultivo>

          <div className="flex justify-end">
            <ColheitaModal
              idPlantio={plantio.id_plantio}
              nomeCultura={nome}
              nomeLote={plantio.lote.nome_lote}
            />
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px]">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#244b49]">
            Cultivo
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Gerencie os plantios, a ocupação dos lotes e os registros.
          </p>
        </div>

        <div className="shrink-0">
          <PlantioModal lotes={lotes} produtos={produtos} />
        </div>
      </header>

      <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          titulo="Cultivos ativos"
          valor={String(ativos.length)}
          descricao="Plantios em andamento"
        />

        <Indicador
          titulo="Área cultivada"
          valor={`${numero(areaCultivada)} ha`}
          descricao={
            areasPendentes > 0
              ? `${areasPendentes} plantio(s) com área pendente`
              : "Soma das áreas dos plantios ativos"
          }
        />

        <Indicador
          titulo="Próxima colheita"
          valor={
            proximaColheita
              ? dataFormatada(proximaColheita.prev_colheita)
              : "Não prevista"
          }
          descricao={
            proximaColheita
              ? proximaColheita.cultura?.nome_cultura ??
                proximaColheita.produto.nome_produto
              : "Sem previsão futura cadastrada"
          }
        />

        <Indicador
          titulo="Colheitas no mês"
          valor={String(colheitasNoMes)}
          descricao="Registros de colheita realizados"
        />
      </section>

      <CultivoPainel
        plantios={
          ativos.length === 0 ? (
            <Vazio texto="Nenhum plantio ativo. Use Novo plantio para iniciar um cultivo." />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {ativos.map(cardPlantio)}
            </div>
          )
        }
        lotes={
          lotesBanco.length === 0 ? (
            <Vazio texto="Nenhum lote cadastrado." />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {lotesBanco.map((lote) => {
                const cultivos = ativos.filter(
                  (plantio) => plantio.id_lote === lote.id_lote,
                );

                const total = Number(lote.area);

                const ocupada = cultivos.reduce(
                  (soma, plantio) =>
                    soma + Number(plantio.area_plantada ?? 0),
                  0,
                );

                const areaPendente = cultivos.some(
                  (plantio) => plantio.area_plantada === null,
                );

                const excesso = ocupada > total;

                const percentual =
                  total > 0
                    ? Math.round((ocupada / total) * 100)
                    : 0;

                return (
                  <article
                    key={lote.id_lote}
                    className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="text-lg font-bold text-[#244b49]">
                      {lote.nome_lote}
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      {lote.status_lote}
                    </p>

                    <div className="mb-2 mt-5 flex justify-between text-sm">
                      <span>Ocupação</span>
                      <strong>
                        {areaPendente ? "Pendente" : `${percentual}%`}
                      </strong>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          excesso ? "bg-red-500" : "bg-[#486d6b]"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(0, percentual))}%`,
                        }}
                      />
                    </div>

                    <dl className="mt-5 space-y-3 text-sm">
                      <Info
                        titulo="Área total"
                        valor={`${numero(total)} ha`}
                      />
                      <Info
                        titulo={
                          areaPendente
                            ? "Área ocupada informada"
                            : "Área ocupada"
                        }
                        valor={`${numero(ocupada)} ha`}
                      />
                      <Info
                        titulo="Área livre"
                        valor={
                          areaPendente
                            ? "A conferir"
                            : `${numero(Math.max(0, total - ocupada))} ha`
                        }
                      />
                      <Info
                        titulo="Plantios ativos"
                        valor={String(cultivos.length)}
                      />
                    </dl>

                    {(areaPendente || excesso) && (
                      <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                        {areaPendente
                          ? "Existem plantios ativos sem área informada."
                          : "Os registros existentes ultrapassam a área do lote."}
                      </p>
                    )}

                    <details className="mt-5 border-t border-slate-100 pt-4">
                      <summary className="cursor-pointer text-sm font-semibold text-[#244b49]">
                        Ver plantios do lote
                      </summary>

                      {cultivos.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">
                          Nenhum plantio ativo neste lote.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-3">
                          {cultivos.map((plantio) => (
                            <li
                              key={plantio.id_plantio}
                              className="rounded-lg bg-slate-50 p-3 text-sm"
                            >
                              <p className="font-semibold">
                                {plantio.cultura?.nome_cultura ??
                                  plantio.produto.nome_produto}
                                {" · "}#{plantio.id_plantio}
                              </p>
                              <p className="mt-1 text-slate-500">
                                {plantio.area_plantada === null
                                  ? "Área não informada"
                                  : `${numero(Number(plantio.area_plantada))} ha`}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </article>
                );
              })}
            </div>
          )
        }
        historico={
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-[#244b49]">
                Registros dos cultivos
              </h2>

              <ListaEventos eventos={eventos} />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-[#244b49]">
                Plantios encerrados ou cancelados
              </h2>

              {encerrados.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhum plantio encerrado ou cancelado.
                </p>
              ) : (
                <ul className="space-y-3">
                  {encerrados.map((plantio) => (
                    <li
                      key={plantio.id_plantio}
                      className="flex flex-col gap-2 rounded-lg bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">
                          {plantio.cultura?.nome_cultura ??
                            plantio.produto.nome_produto}
                          {" · "}#{plantio.id_plantio}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {plantio.lote.nome_lote}
                          {" · Plantado em "}
                          {dataFormatada(plantio.data_plantio)}
                        </p>
                      </div>

                      <span className="text-xs font-semibold text-slate-600">
                        {plantio.status_plantio}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        }
      />
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  descricao,
}: {
  titulo: string;
  valor: string;
  descricao: string;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {titulo}
      </p>

      <p className="mt-3 break-words text-2xl font-bold text-[#244b49]">
        {valor}
      </p>

      <p className="mt-3 text-xs text-slate-500">
        {descricao}
      </p>
    </article>
  );
}

function Info({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500">{titulo}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-slate-800">
        {valor}
      </dd>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {texto}
    </div>
  );
}

function ListaEventos({ eventos }: { eventos: Evento[] }) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Nenhum evento registrado.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {eventos.map((evento) => (
        <li
          key={evento.chave}
          className="rounded-lg border border-slate-100 bg-slate-50 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm text-[#244b49]">
              {evento.tipo}
            </strong>

            <span className="text-xs text-slate-500">
              {dataFormatada(evento.data)}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-700">
            {evento.cultura} · {evento.lote} · Plantio #
            {evento.idPlantio}
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-800">
            {numero(evento.quantidade)} {evento.unidade}
          </p>

          {evento.observacao && (
            <p className="mt-2 break-words text-sm text-slate-500">
              {evento.observacao}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}