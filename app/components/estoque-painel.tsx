"use client";

import { useId, useState } from "react";
import ProdutoModal from "@/app/components/produtomodal";
import MovimentacaoModal from "@/app/components/movimentacaomodal";

export type ProdutoEstoque = {
  id_produto: number;
  nome_produto: string;
  categoria: string;
  quantidade: number;
  estoque_min: number;
  unidade_medida: string;
  id_cultura: number | null;
  culturaNome: string | null;
};

export type MovimentoEstoque = {
  id: number;
  produto: string;
  tipo: string;
  quantidade: number;
  unidade: string;
  data: string;
  responsavel: string;
  observacao: string | null;
};

type Props = {
  produtos: ProdutoEstoque[];
  movimentacoes: MovimentoEstoque[];
  movimentacoesHoje: number;
};

type Situacao = "NORMAL" | "BAIXO" | "SEM_ESTOQUE";

type NomeIcone =
  | "caixa"
  | "alerta"
  | "movimento"
  | "valor"
  | "busca"
  | "filtro"
  | "planta";

function numero(valor: number) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function unidade(valor: string) {
  const unidades: Record<string, string> = {
    KG: "kg",
    G: "g",
    L: "L",
    ML: "mL",
    UNIDADE: "un.",
    SACA: "saca",
    DOSE: "dose",
    MUDA: "muda",
  };

  return unidades[valor.trim().toUpperCase()] ?? valor;
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function categoriaExibida(produto: ProdutoEstoque) {
  if (
    produto.categoria === "Outro" &&
    produto.id_cultura !== null &&
    produto.unidade_medida.trim().toUpperCase() === "KG"
  ) {
    return "Produto colhido";
  }

  return produto.categoria;
}

function situacao(produto: ProdutoEstoque): Situacao {
  if (produto.quantidade <= 0) {
    return "SEM_ESTOQUE";
  }

  return produto.quantidade < produto.estoque_min
    ? "BAIXO"
    : "NORMAL";
}

export default function EstoquePainel({
  produtos,
  movimentacoes,
  movimentacoesHoje,
}: Props) {
  const filtroId = useId();

  const [busca, setBusca] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [status, setStatus] = useState("");

  const categorias = Array.from(
    new Set(produtos.map(categoriaExibida)),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const semEstoque = produtos.filter(
    (produto) => situacao(produto) === "SEM_ESTOQUE",
  ).length;

  const abaixoMinimo = produtos.filter(
    (produto) => situacao(produto) === "BAIXO",
  ).length;

  const produtosFiltrados = produtos.filter((produto) => {
    const texto = normalizar(
      `${produto.nome_produto} ${produto.id_produto} ${
        produto.culturaNome ?? ""
      }`,
    );

    return (
      texto.includes(normalizar(busca)) &&
      (!categoria || categoriaExibida(produto) === categoria) &&
      (!status || situacao(produto) === status)
    );
  });

  const possuiFiltro = Boolean(busca || categoria || status);

  function limparFiltros() {
    setBusca("");
    setCategoria("");
    setStatus("");
  }

  const input =
    "w-full min-w-0 rounded-lg border border-slate-300 bg-white " +
    "px-3 py-2.5 text-sm outline-none focus:border-[#486d6b] " +
    "focus:ring-2 focus:ring-[#486d6b]/15";

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px] text-slate-700">
      <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#444]">
            Estoque
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie a entrada e saída de produtos.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ProdutoModal />
          <MovimentacaoModal produtos={produtos} />
        </div>
      </header>

      <section
        aria-label="Resumo do estoque"
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Indicador
          titulo="Total de produtos"
          valor={produtos.length.toLocaleString("pt-BR")}
          descricao="Produtos cadastrados"
          icone="caixa"
        />

        <Indicador
          titulo="Produtos em alerta"
          valor={(semEstoque + abaixoMinimo).toLocaleString("pt-BR")}
          descricao={`${abaixoMinimo} abaixo do mínimo · ${semEstoque} sem estoque`}
          icone="alerta"
          alerta
        />

        <Indicador
          titulo="Movimentações hoje"
          valor={movimentacoesHoje.toLocaleString("pt-BR")}
          descricao="Entradas e saídas registradas"
          icone="movimento"
        />

        <Indicador
          titulo="Valor em estoque"
          valor="Não disponível"
          descricao="Custos dos produtos ainda não cadastrados"
          icone="valor"
        />
      </section>

      <section className="min-w-0 rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#444]">
              Níveis de estoque
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Visualize o estoque de todos os produtos.
            </p>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <label className="relative block min-w-0 flex-1 lg:w-72">
              <span className="sr-only">
                Buscar por produto, código ou cultura
              </span>

              <span className="pointer-events-none absolute left-3 top-3 text-slate-500">
                <Icone nome="busca" />
              </span>

              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar produtos..."
                className={`${input} pl-10`}
              />
            </label>

            <button
              type="button"
              aria-label="Mostrar filtros"
              aria-expanded={mostrarFiltros}
              aria-controls={filtroId}
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className="shrink-0 rounded-lg bg-[#486d6b] p-3 text-white hover:bg-[#365553]"
            >
              <Icone nome="filtro" />
            </button>
          </div>
        </div>

        {mostrarFiltros && (
          <div
            id={filtroId}
            className="mb-4 grid grid-cols-1 items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3"
          >
            <label className="block min-w-0 text-sm">
              <span className="mb-2 block font-semibold">Categoria</span>
              <select
                value={categoria}
                onChange={(event) => setCategoria(event.target.value)}
                className={input}
              >
                <option value="">Todas</option>
                {categorias.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0 text-sm">
              <span className="mb-2 block font-semibold">Situação</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={input}
              >
                <option value="">Todas</option>
                <option value="NORMAL">Normal</option>
                <option value="BAIXO">Estoque baixo</option>
                <option value="SEM_ESTOQUE">Sem estoque</option>
              </select>
            </label>

            <button
              type="button"
              onClick={limparFiltros}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-100"
            >
              Limpar filtros
            </button>
          </div>
        )}

        <p aria-live="polite" className="mb-3 text-xs text-slate-500">
          {produtosFiltrados.length} de {produtos.length} produtos
        </p>

        {produtosFiltrados.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#edf3f2] text-[#486d6b]">
              <Icone nome="caixa" />
            </div>

            <p className="font-semibold">
              {produtos.length === 0
                ? "Nenhum produto cadastrado"
                : "Nenhum produto encontrado"}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {produtos.length === 0
                ? "Use Novo produto para começar."
                : "Experimente outro nome ou ajuste os filtros."}
            </p>

            {possuiFiltro && (
              <button
                type="button"
                onClick={limparFiltros}
                className="mt-4 text-sm font-semibold text-[#486d6b]"
              >
                Limpar pesquisa e filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden max-w-full overflow-x-auto rounded-lg border border-[#315c5e] lg:block">
              <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                <caption className="sr-only">
                  Produtos, saldos, níveis mínimos e situação do estoque
                </caption>

                <thead>
                  <tr className="border-b border-[#315c5e] text-slate-800">
                    <th scope="col" className="w-[28%] px-4 py-4">
                      Produto
                    </th>
                    <th scope="col" className="w-[18%] px-4 py-4">
                      Estoque atual
                    </th>
                    <th scope="col" className="w-[18%] px-4 py-4">
                      Estoque mínimo
                    </th>
                    <th scope="col" className="w-[20%] px-4 py-4">
                      Nível
                    </th>
                    <th scope="col" className="w-[16%] px-4 py-4">
                      Situação
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#315c5e]/40">
                  {produtosFiltrados.map((produto) => (
                    <tr
                      key={produto.id_produto}
                      className="hover:bg-[#f4f8f7]"
                    >
                      <td className="px-4 py-4">
                        <Identificacao produto={produto} />
                      </td>

                      <td className="break-words px-4 py-4 font-semibold">
                        {numero(produto.quantidade)}{" "}
                        {unidade(produto.unidade_medida)}
                      </td>

                      <td className="break-words px-4 py-4">
                        {numero(produto.estoque_min)}{" "}
                        {unidade(produto.unidade_medida)}
                      </td>

                      <td className="px-4 py-4">
                        <Nivel produto={produto} />
                      </td>

                      <td className="px-4 py-4">
                        <Etiqueta produto={produto} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 lg:hidden">
              {produtosFiltrados.map((produto) => (
                <li
                  key={produto.id_produto}
                  className="min-w-0 rounded-lg border border-[#315c5e]/30 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Identificacao produto={produto} />
                    <Etiqueta produto={produto} />
                  </div>

                  <dl className="my-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">
                        Estoque atual
                      </dt>
                      <dd className="mt-1 break-words font-semibold">
                        {numero(produto.quantidade)}{" "}
                        {unidade(produto.unidade_medida)}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">
                        Estoque mínimo
                      </dt>
                      <dd className="mt-1 break-words font-semibold">
                        {numero(produto.estoque_min)}{" "}
                        {unidade(produto.unidade_medida)}
                      </dd>
                    </div>
                  </dl>

                  <Nivel produto={produto} />
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-4 text-xs text-slate-500">
          A barra compara o saldo ao mínimo cadastrado. Uma barra
          completa indica que o mínimo foi atingido, não que o
          depósito está cheio.
        </p>
      </section>

      <details className="mt-6 min-w-0 rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <summary className="cursor-pointer font-semibold text-[#444]">
          Movimentações recentes
        </summary>

        <p className="mt-2 text-xs text-slate-500">
          Últimos 10 registros. Horários de Brasília.
        </p>

        {movimentacoes.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">
            Nenhuma movimentação registrada.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {movimentacoes.map((movimento) => {
              const entrada = movimento.tipo === "ENTRADA";
              const saida = ["SAIDA", "SAÍDA"].includes(
                movimento.tipo,
              );

              return (
                <li key={movimento.id} className="py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <p className="break-words font-semibold">
                      {movimento.produto}
                    </p>

                    <p
                      className={`text-sm font-semibold ${
                        entrada
                          ? "text-[#486d6b]"
                          : saida
                            ? "text-red-700"
                            : "text-slate-600"
                      }`}
                    >
                      {entrada ? "Entrada" : saida ? "Saída" : movimento.tipo}
                      {" · "}
                      {numero(movimento.quantidade)}{" "}
                      {unidade(movimento.unidade)}
                    </p>
                  </div>

                  <p className="mt-1 break-words text-xs text-slate-500">
                    {new Date(movimento.data).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "America/Sao_Paulo",
                    })}
                    {" · "}
                    {movimento.responsavel}
                  </p>

                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">
                    {movimento.observacao || "Sem observação"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </div>
  );
}

function Identificacao({ produto }: { produto: ProdutoEstoque }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#123e40] text-white">
        <Icone nome={produto.id_cultura !== null ? "planta" : "caixa"} />
      </span>

      <div className="min-w-0">
        <p className="break-words font-semibold">{produto.nome_produto}</p>
        <p className="mt-1 break-words text-xs text-slate-500">
          {categoriaExibida(produto)}
          {produto.culturaNome ? ` · ${produto.culturaNome}` : ""}
        </p>
      </div>
    </div>
  );
}

function Nivel({ produto }: { produto: ProdutoEstoque }) {
  if (produto.estoque_min <= 0) {
    return (
      <span className="text-xs text-slate-500">
        Sem mínimo definido
      </span>
    );
  }

  const percentual = Math.max(
    0,
    (produto.quantidade / produto.estoque_min) * 100,
  );

  const cor =
    situacao(produto) === "NORMAL"
      ? "bg-[#486d6b]"
      : situacao(produto) === "BAIXO"
        ? "bg-amber-600"
        : "bg-red-600";

  return (
    <div>
      <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${cor}`}
          style={{ width: `${Math.min(100, percentual)}%` }}
        />
      </div>

      <p className="mt-1.5 text-xs text-slate-500">
        {percentual.toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
        })}
        % do mínimo
      </p>
    </div>
  );
}

function Etiqueta({ produto }: { produto: ProdutoEstoque }) {
  const config = {
    NORMAL: {
      texto: "Normal",
      classe: "bg-[#486d6b] text-white",
    },
    BAIXO: {
      texto: "Baixo",
      classe: "bg-amber-600 text-white",
    },
    SEM_ESTOQUE: {
      texto: "Sem estoque",
      classe: "bg-red-50 text-red-700",
    },
  }[situacao(produto)];

  return (
    <span
      className={`inline-block rounded-md px-3 py-1.5 text-xs font-semibold ${config.classe}`}
    >
      {config.texto}
    </span>
  );
}

function Indicador({
  titulo,
  valor,
  descricao,
  icone,
  alerta = false,
}: {
  titulo: string;
  valor: string;
  descricao: string;
  icone: NomeIcone;
  alerta?: boolean;
}) {
  return (
    <article className="flex min-w-0 flex-col rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <span className={alerta ? "text-amber-600" : "text-[#486d6b]"}>
          <Icone nome={icone} />
        </span>
      </div>

      <p
        className={`my-5 break-words text-2xl font-bold ${
          alerta ? "text-amber-700" : "text-[#444]"
        }`}
      >
        {valor}
      </p>

      <p className="mt-auto text-xs text-slate-500">{descricao}</p>
    </article>
  );
}

function Icone({ nome }: { nome: NomeIcone }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      {nome === "caixa" && (
        <>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" />
        </>
      )}

      {nome === "alerta" && (
        <>
          <path d="m12 3 10 18H2L12 3Z" />
          <path d="M12 9v5M12 17h.01" />
        </>
      )}

      {nome === "movimento" && (
        <>
          <path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4" />
        </>
      )}

      {nome === "valor" && (
        <>
          <path d="M12 2v20M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6" />
        </>
      )}

      {nome === "busca" && (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </>
      )}

      {nome === "filtro" && (
        <path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z" />
      )}

      {nome === "planta" && (
        <>
          <path d="M12 21v-9M12 15C5 15 3 11 3 5c6 0 9 3 9 8" />
          <path d="M12 12c0-6 3-9 9-9 0 6-3 9-9 9ZM6 21h12" />
        </>
      )}
    </svg>
  );
}