"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import AnimalModal from "@/app/components/animalmodal";
import AnimalHistorico from "@/app/components/animal-historico";
import AnimalAlimentacao from "@/app/components/animal-alimentacao";
import AnimalVacinacao from "@/app/components/animal-vacinacao";

type Animal = {
  id: number;
  nome: string;
  especie: string;
  raca: string | null;
  sexo: string;
  nascimento: string | null;
  peso: number | null;
  saude: string | null;
  foto: string | null;
  status: string;
  criadoEm: string | null;
  alimentacoes: number;
  vacinacoes: number;
};

type Props = {
  animais: Animal[];
  especies: {
    id_especie: number;
    nome_especie: string;
  }[];
};

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatarPeso(peso: number | null) {
  if (peso === null) {
    return "Não informado";
  }

  return `${peso.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;
}

function formatarData(valor: string | null) {
  if (!valor) {
    return "Não informada";
  }

  const data = valor.slice(0, 10);
  const [ano, mes, dia] = data.split("-");

  return `${dia}/${mes}/${ano}`;
}

function formatarSexo(sexo: string) {
  if (sexo === "M") return "Macho";
  if (sexo === "F") return "Fêmea";
  return "Não informado";
}

export default function AnimaisPainel({ animais, especies }: Props) {
  const [busca, setBusca] = useState("");
  const [filtroEspecie, setFiltroEspecie] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);

  const especiesDisponiveis = Array.from(
    new Set(animais.map((animal) => animal.especie)),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const ativos = animais.filter((animal) => animal.status === "ATIVO");

  const acompanhamento = ativos.filter(
    (animal) =>
      animal.saude === "EM OBSERVAÇÃO" || animal.saude === "EM TRATAMENTO",
  ).length;

  const termo = normalizar(busca);

  const filtrados = animais.filter((animal) => {
    const correspondeBusca = normalizar(
      `${animal.id} ${animal.nome} ${animal.especie} ${animal.raca ?? ""}`,
    ).includes(termo);

    const correspondeEspecie =
      !filtroEspecie || animal.especie === filtroEspecie;

    const correspondeStatus =
      !filtroStatus ||
      (filtroStatus === "ATIVO"
        ? animal.status === "ATIVO"
        : animal.status !== "ATIVO");

    return correspondeBusca && correspondeEspecie && correspondeStatus;
  });

  const selecionado =
    animais.find((animal) => animal.id === selecionadoId) ?? null;

  function limparFiltros() {
    setBusca("");
    setFiltroEspecie("");
    setFiltroStatus("");
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#486d6b]">
            Pecuária
          </p>

          <h1 className="mt-1 text-3xl font-bold text-[#244b49]">Animais</h1>

          <p className="mt-2 text-sm text-slate-500">
            Consulte o rebanho e acompanhe cada animal.
          </p>
        </div>

        <AnimalModal especies={especies} />
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Indicador
          titulo="Animais cadastrados"
          valor={animais.length}
          descricao="Todos os cadastros"
          icone="animal"
        />

        <Indicador
          titulo="Animais ativos"
          valor={ativos.length}
          descricao="Cadastros com status ativo"
          icone="check"
        />

        <Indicador
          titulo="Em acompanhamento"
          valor={acompanhamento}
          descricao="Ativos em observação ou tratamento"
          icone="saude"
        />
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-slate-200 p-4 sm:p-6">
          <div>
            <h2 className="font-bold text-[#244b49]">Todos os animais</h2>

            <p className="mt-1 text-sm text-slate-500">
              Abra o perfil para consultar os detalhes.
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <label className="relative block min-w-0">
              <span className="sr-only">Buscar animais</span>

              <span className="pointer-events-none absolute left-3 top-3 text-slate-400">
                <Icone tipo="busca" />
              </span>

              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Nome, código, espécie ou raça"
                className="input input-busca"
              />
            </label>

            <select
              aria-label="Filtrar por espécie"
              value={filtroEspecie}
              onChange={(event) => setFiltroEspecie(event.target.value)}
              className="input"
            >
              <option value="">Todas as espécies</option>

              {especiesDisponiveis.map((especie) => (
                <option key={especie} value={especie}>
                  {especie}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por status"
              value={filtroStatus}
              onChange={(event) => setFiltroStatus(event.target.value)}
              className="input"
            >
              <option value="">Todos os status</option>
              <option value="ATIVO">Ativos</option>
              <option value="OUTROS">Outros status</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p aria-live="polite" className="text-xs text-slate-500">
              {filtrados.length} de {animais.length} animais
            </p>

            {(busca || filtroEspecie || filtroStatus) && (
              <button
                type="button"
                onClick={limparFiltros}
                className="text-sm font-semibold text-[#486d6b] hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="estado-vazio m-4 sm:m-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#486d6b]/10 text-[#486d6b]">
              <Icone tipo="animal" />
            </div>

            <h3 className="mt-4 font-semibold text-slate-800">
              {animais.length === 0
                ? "Nenhum animal cadastrado"
                : "Nenhum animal encontrado"}
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              {animais.length === 0
                ? "Use o botão Novo animal para começar."
                : "Experimente alterar a busca ou os filtros."}
            </p>
          </div>
        ) : (
          <>
            <div tabIndex={0} role="region" aria-label="Tabela de animais" className="hidden max-w-full overflow-x-auto lg:block">
              <table className="w-full min-w-[800px] table-fixed text-left text-sm">
                <thead className="bg-[#486d6b] text-white">
                  <tr>
                    {[
                      "Animal",
                      "Espécie / raça",
                      "Sexo",
                      "Peso",
                      "Saúde",
                      "Status",
                      "Perfil",
                    ].map((titulo) => (
                      <th
                        key={titulo}
                        scope="col"
                        className="px-4 py-4 font-medium"
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filtrados.map((animal) => (
                    <tr key={animal.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <Identificacao animal={animal} />
                      </td>

                      <td className="px-4 py-4">
                        <p>{animal.especie}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {animal.raca || "Raça não informada"}
                        </p>
                      </td>

                      <td className="px-4 py-4">{formatarSexo(animal.sexo)}</td>

                      <td className="whitespace-nowrap px-4 py-4">
                        {formatarPeso(animal.peso)}
                      </td>

                      <td className="px-4 py-4">
                        <Saude valor={animal.saude} />
                      </td>

                      <td className="px-4 py-4">
                        <Status valor={animal.status} />
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setSelecionadoId(animal.id)}
                          aria-label={`Ver detalhes de ${animal.nome}`}
                          className="rounded-lg px-3 py-2 font-semibold text-[#486d6b] hover:bg-[#486d6b]/10"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:hidden">
              {filtrados.map((animal) => (
                <article
                  key={animal.id}
                  className="min-w-0 rounded-xl border border-slate-200 p-4"
                >
                  <Identificacao animal={animal} />

                  <p className="mt-3 text-sm text-slate-500">
                    {animal.especie} · {formatarSexo(animal.sexo)}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    Peso: {formatarPeso(animal.peso)}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Saude valor={animal.saude} />
                    <Status valor={animal.status} />
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelecionadoId(animal.id)}
                    aria-label={`Ver perfil de ${animal.nome}`}
                    className="mt-5 w-full rounded-lg border border-[#486d6b] py-2.5 text-sm font-semibold text-[#486d6b] hover:bg-[#486d6b]/5"
                  >
                    Ver perfil
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {selecionado && (
        <PerfilAnimal
          animal={selecionado}
          fechar={() => setSelecionadoId(null)}
        />
      )}
    </div>
  );
}

function PerfilAnimal({
  animal,
  fechar,
}: {
  animal: Animal;
  fechar: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const [versaoHistorico, setVersaoHistorico] = useState(0);
  const [salvandoAlimentacao, setSalvandoAlimentacao] = useState(false);
  const [salvandoVacinacao, setSalvandoVacinacao] = useState(false);

  const salvandoRegistro = salvandoAlimentacao || salvandoVacinacao;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const overflowAnterior = document.body.style.overflow;

    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      dialog.close();
      document.body.style.overflow = overflowAnterior;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={tituloId}
      onCancel={(event) => {
        event.preventDefault();

        if (!salvandoRegistro) {
          fechar();
        }
      }}
      className="fixed inset-0 m-auto max-h-[92dvh] w-[94vw] max-w-3xl overflow-y-auto rounded-2xl border-0 bg-[#f5f5f5] p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#244b49] text-white">
            <Icone tipo="animal" />
          </div>

          <div className="min-w-0">
            <h2
              id={tituloId}
              className="break-words text-xl font-bold text-[#244b49]"
            >
              {animal.nome}
            </h2>

            <p className="text-sm text-slate-500">
              #{String(animal.id).padStart(4, "0")} · {animal.especie}
            </p>
          </div>
        </div>

        <button
          type="button"
          autoFocus
          onClick={fechar}
          disabled={salvandoRegistro}
          aria-label="Fechar perfil"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <Icone tipo="fechar" />
        </button>
      </header>

      <div className="space-y-5 p-4 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <section
            aria-label="Foto do animal"
            className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <FotoAnimal
              key={animal.foto ?? "sem-foto"}
              foto={animal.foto}
              nome={animal.nome}
              grande
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-[#244b49]">Identificação</h3>

            <dl className="mt-4 space-y-4">
              <Dado titulo="Espécie">{animal.especie}</Dado>
              <Dado titulo="Raça">{animal.raca || "Não informada"}</Dado>
              <Dado titulo="Sexo">{formatarSexo(animal.sexo)}</Dado>
              <Dado titulo="Nascimento">{formatarData(animal.nascimento)}</Dado>
            </dl>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-[#244b49]">Situação atual</h3>

          <dl className="mt-4 grid gap-5 sm:grid-cols-3">
            <Dado titulo="Peso informado">{formatarPeso(animal.peso)}</Dado>

            <Dado titulo="Saúde">
              <Saude valor={animal.saude} />
            </Dado>

            <Dado titulo="Status">
              <Status valor={animal.status} />
            </Dado>
          </dl>
        </section>

        <fieldset disabled={salvandoVacinacao} className="min-w-0">
          <AnimalAlimentacao
            idAnimal={animal.id}
            ativo={animal.status === "ATIVO"}
            aoAlterarEnvio={setSalvandoAlimentacao}
            aoSalvar={() => {
              setVersaoHistorico((valor) => valor + 1);
            }}
          />
        </fieldset>

        <fieldset disabled={salvandoAlimentacao} className="min-w-0">
          <AnimalVacinacao
            idAnimal={animal.id}
            ativo={animal.status === "ATIVO"}
            aoAlterarEnvio={setSalvandoVacinacao}
            aoSalvar={() => {
              setVersaoHistorico((valor) => valor + 1);
            }}
          />
        </fieldset>

        <AnimalHistorico
          key={`${animal.id}-${versaoHistorico}`}
          idAnimal={animal.id}
        />

        <footer className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Cadastro: {formatarData(animal.criadoEm)}
          </p>

          <button
            type="button"
            onClick={fechar}
            disabled={salvandoRegistro}
            className="rounded-xl bg-[#486d6b] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#244b49]"
          >
            Fechar perfil
          </button>
        </footer>
      </div>
    </dialog>
  );
}

function Identificacao({ animal }: { animal: Animal }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <FotoAnimal
        key={animal.foto ?? "sem-foto"}
        foto={animal.foto}
        nome={animal.nome}
      />

      <div className="min-w-0">
        <p className="break-words font-semibold text-slate-800">
          {animal.nome}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          #{String(animal.id).padStart(4, "0")}
        </p>
      </div>
    </div>
  );
}

function FotoAnimal({
  foto,
  nome,
  grande = false,
}: {
  foto: string | null;
  nome: string;
  grande?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);

  return (
    <div
      className={
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#486d6b]/10 text-[#486d6b] " +
        (grande ? "h-44 w-44 sm:h-48 sm:w-48" : "h-11 w-11")
      }
    >
      {foto && !falhou ? (
        // URLs de fotos cadastradas no Cloudinary.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={foto}
          alt={`Foto de ${nome}`}
          loading={grande ? "eager" : "lazy"}
          onError={() => setFalhou(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={foto ? "Foto indisponível" : "Animal sem foto"}
          className="flex flex-col items-center gap-2"
        >
          <Icone tipo="animal" />
          {grande && (
            <span className="text-xs">
              {foto ? "Foto indisponível" : "Sem foto"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Saude({ valor }: { valor: string | null }) {
  const cores =
    valor === "SAUDÁVEL"
      ? "bg-emerald-50 text-emerald-700"
      : valor === "EM OBSERVAÇÃO"
        ? "bg-amber-50 text-amber-800"
        : valor === "EM TRATAMENTO"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-100 text-slate-600";

  const texto =
    valor === "SAUDÁVEL"
      ? "Saudável"
      : valor === "EM OBSERVAÇÃO"
        ? "Em observação"
        : valor === "EM TRATAMENTO"
          ? "Em tratamento"
          : valor || "Não informada";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${cores}`}
    >
      {texto}
    </span>
  );
}

function Status({ valor }: { valor: string }) {
  return (
    <span
      className={
        "inline-flex rounded-full px-3 py-1 text-xs font-medium " +
        (valor === "ATIVO"
          ? "bg-[#486d6b]/10 text-[#244b49]"
          : "bg-slate-100 text-slate-600")
      }
    >
      {valor === "ATIVO" ? "Ativo" : valor}
    </span>
  );
}

function Dado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{titulo}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-800">
        {children}
      </dd>
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  descricao,
  icone,
}: {
  titulo: string;
  valor: number;
  descricao: string;
  icone: "animal" | "check" | "saude";
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{titulo}</p>
          <p className="mt-2 text-3xl font-bold text-[#244b49]">{valor}</p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#486d6b]/10 text-[#486d6b]">
          <Icone tipo={icone} />
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">{descricao}</p>
    </article>
  );
}

function Icone({
  tipo,
}: {
  tipo: "animal" | "check" | "saude" | "busca" | "fechar";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {tipo === "animal" && (
        <>
          <path d="M7 7 4 4 2 7l4 3v7a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-7l4-3-2-3-3 3Z" />
          <path d="M8 7 7 3M16 7l1-4M9 12h.01M15 12h.01" />
          <rect x="8" y="15" width="8" height="5" rx="2" />
        </>
      )}

      {tipo === "check" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </>
      )}

      {tipo === "saude" && (
        <>
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
          <path d="M8 12h8M12 8v8" />
        </>
      )}

      {tipo === "busca" && (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4 4" />
        </>
      )}

      {tipo === "fechar" && <path d="m6 6 12 12M18 6 6 18" />}
    </svg>
  );
}
