"use client";

import { useEffect, useState } from "react";

type Registro = {
  chave: string;
  tipo: "ALIMENTACAO" | "VACINACAO";
  data: string;
  produto: string;
  quantidade: string | null;
  unidade: string | null;
  observacao: string | null;
  responsavel: string;
};

const estiloCampo = "input";

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatarData(valor: string) {
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarQuantidade(registro: Registro) {
  if (registro.quantidade === null) {
    return "Não informada";
  }

  const numero = Number(registro.quantidade).toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );

  const unidade = registro.unidade?.trim();

  if (!unidade) {
    return numero;
  }

  const unidadeExibida =
    unidade.toUpperCase() === "DOSE"
      ? Number(registro.quantidade) === 1
        ? "dose"
        : "doses"
      : unidade.toUpperCase() === "ML"
        ? "mL"
        : unidade;

  return `${numero} ${unidadeExibida}`;
}

export default function AnimalHistorico({
  idAnimal,
}: {
  idAnimal: number;
}) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);

  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [data, setData] = useState("");

  useEffect(() => {
    const controlador = new AbortController();

    async function carregarHistorico() {
      setCarregando(true);
      setErro("");
      setRegistros([]);

      try {
        const resposta = await fetch(
          `/api/animais/historico?idAnimal=${idAnimal}`,
          {
            signal: controlador.signal,
            cache: "no-store",
          },
        );

        const dados = await resposta.json().catch(() => null);

        if (!resposta.ok) {
          throw new Error(
            typeof dados?.error === "string"
              ? dados.error
              : "Não foi possível carregar o histórico.",
          );
        }

        if (!Array.isArray(dados?.registros)) {
          throw new Error(
            "O servidor retornou um histórico inválido.",
          );
        }

        if (!controlador.signal.aborted) {
          setRegistros(dados.registros);
        }
      } catch (error) {
        if (controlador.signal.aborted) {
          return;
        }

        setErro(
          error instanceof Error
            ? error.message
            : "Ocorreu um erro ao carregar o histórico.",
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    carregarHistorico();

    return () => {
      controlador.abort();
    };
  }, [idAnimal, tentativa]);

  const termo = normalizar(busca);

  const filtrados = registros.filter((registro) => {
    const correspondeTipo = !tipo || registro.tipo === tipo;
    const correspondeData = !data || registro.data === data;

    const correspondeBusca = normalizar(
      `${registro.produto} ${registro.observacao ?? ""} ${registro.responsavel}`,
    ).includes(termo);

    return (
      correspondeTipo &&
      correspondeData &&
      correspondeBusca
    );
  });

  function limparFiltros() {
    setBusca("");
    setTipo("");
    setData("");
  }

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="font-semibold text-[#244b49]">
        Histórico do animal
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Últimos 50 registros de alimentação e últimos 50 de
        vacinação.
      </p>

      <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="block min-w-0 sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">
            Buscar nos registros carregados
          </span>

          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Produto, observação ou responsável"
            className={estiloCampo}
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">
            Tipo de registro
          </span>

          <select
            value={tipo}
            onChange={(event) => setTipo(event.target.value)}
            className={estiloCampo}
          >
            <option value="">Todos os tipos</option>
            <option value="ALIMENTACAO">Alimentação</option>
            <option value="VACINACAO">Vacinação</option>
          </select>
        </label>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">
            Data
          </span>

          <input
            type="date"
            value={data}
            onChange={(event) => setData(event.target.value)}
            className={estiloCampo}
          />
        </label>
      </div>

      {(busca || tipo || data) && (
        <button
          type="button"
          onClick={limparFiltros}
          className="mt-3 text-sm font-semibold text-[#486d6b] hover:underline"
        >
          Limpar filtros
        </button>
      )}

      {carregando ? (
        <p
          role="status"
          className="py-10 text-center text-sm text-slate-500"
        >
          Carregando histórico...
        </p>
      ) : erro ? (
        <div
          role="alert"
          className="mt-5 rounded-xl bg-red-50 p-4"
        >
          <p className="text-sm text-red-700">{erro}</p>

          <button
            type="button"
            onClick={() => setTentativa((valor) => valor + 1)}
            className="mt-3 text-sm font-semibold text-red-700 underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            {registros.length === 0
              ? "Nenhum registro cadastrado"
              : "Nenhum registro corresponde aos filtros"}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {registros.length === 0
              ? "Os registros de alimentação e vacinação aparecerão aqui."
              : "Altere a busca, a data ou o tipo selecionado."}
          </p>
        </div>
      ) : (
        <>
          <p
            aria-live="polite"
            className="mb-3 mt-5 text-xs text-slate-500"
          >
            {filtrados.length} de {registros.length} registros
            carregados
          </p>

          <div tabIndex={0} role="region" aria-label="Tabela do histórico do animal" className="hidden max-w-full overflow-x-auto rounded-xl border border-slate-200 sm:block">
            <table className="w-full min-w-[600px] table-fixed text-left text-sm">
              <thead className="bg-[#486d6b] text-white">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Tipo / produto
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Quantidade / dose
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Registro
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filtrados.map((registro) => (
                  <tr
                    key={registro.chave}
                    className="align-top hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-4">
                      {formatarData(registro.data)}
                    </td>

                    <td className="px-4 py-4">
                      <TipoRegistro tipo={registro.tipo} />

                      <p className="mt-2 break-words font-medium text-slate-700">
                        {registro.produto}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <Quantidade registro={registro} />
                    </td>

                    <td className="px-4 py-4">
                      <p className="whitespace-pre-wrap break-words text-slate-600">
                        {registro.observacao || "Sem observação"}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        Registrado por {registro.responsavel}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 sm:hidden">
            {filtrados.map((registro) => (
              <article
                key={registro.chave}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <TipoRegistro tipo={registro.tipo} />

                  <span className="text-xs text-slate-500">
                    {formatarData(registro.data)}
                  </span>
                </div>

                <p className="mt-3 break-words font-semibold text-slate-800">
                  {registro.produto}
                </p>

                <div className="mt-2 text-sm text-slate-600">
                  <span className="font-medium">
                    {registro.tipo === "VACINACAO"
                      ? "Dose: "
                      : "Quantidade: "}
                  </span>
                  <Quantidade registro={registro} />
                </div>

                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-600">
                  {registro.observacao || "Sem observação"}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  Registrado por {registro.responsavel}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Quantidade({ registro }: { registro: Registro }) {
  return (
    <>
      <span>{formatarQuantidade(registro)}</span>

      {registro.tipo === "VACINACAO" &&
        registro.quantidade !== null &&
        !registro.unidade?.trim() && (
          <span className="mt-1 block text-xs text-slate-500">
            Unidade não registrada
          </span>
        )}
    </>
  );
}

function TipoRegistro({
  tipo,
}: {
  tipo: Registro["tipo"];
}) {
  return (
    <span
      className={
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium " +
        (tipo === "ALIMENTACAO"
          ? "bg-[#486d6b]/10 text-[#244b49]"
          : "bg-blue-50 text-blue-700")
      }
    >
      {tipo === "ALIMENTACAO" ? "Alimentação" : "Vacinação"}
    </span>
  );
}
