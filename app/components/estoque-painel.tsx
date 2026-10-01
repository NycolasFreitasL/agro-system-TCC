"use client";

import { useId, useState } from "react";
import { noMinimoOuAbaixo } from "@/app/lib/estoque-regras";
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

  return noMinimoOuAbaixo(produto.quantidade, produto.estoque_min)
    ? "BAIXO"
    : "NORMAL";
}

export default function EstoquePainel({
  produtos,
  movimentacoes,
  movimentacoesHoje,
}: Props) {
  const filtroId = useId();
  const buscaId = useId();
  const [busca, setBusca] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [status, setStatus] = useState("");

  const categorias = Array.from(new Set(produtos.map(categoriaExibida)))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const semEstoque = produtos.filter((produto) => situacao(produto) === "SEM_ESTOQUE").length;
  const noMinimo = produtos.filter((produto) => noMinimoOuAbaixo(produto.quantidade, produto.estoque_min)).length;
  const produtosFiltrados = produtos.filter((produto) => {
    const texto = normalizar(`${produto.nome_produto} ${produto.id_produto} ${produto.culturaNome ?? ""}`);
    return texto.includes(normalizar(busca))
      && (!categoria || categoriaExibida(produto) === categoria)
      && (!status || (status === "BAIXO"
        ? noMinimoOuAbaixo(produto.quantidade, produto.estoque_min)
        : situacao(produto) === status));
  });
  const filtrosAtivos = Number(Boolean(categoria)) + Number(Boolean(status));
  const possuiFiltro = Boolean(busca.trim() || filtrosAtivos);

  function limparFiltros() {
    setBusca("");
    setCategoria("");
    setStatus("");
  }

  return (
    <div className="estoque-ui mx-auto w-full min-w-0 max-w-[1440px] space-y-5 text-slate-700">
      <header className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[#486d6b]">Gestão de produtos</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#244b49] sm:text-3xl">Estoque</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Acompanhe saldos, mínimos e movimentações dos produtos da fazenda.</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <MovimentacaoModal produtos={produtos} />
          <ProdutoModal />
        </div>
      </header>

      <section aria-label="Resumo do estoque" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        <Indicador titulo="Produtos cadastrados" valor={produtos.length.toLocaleString("pt-BR")}
          descricao="Todos os produtos, inclusive os sem saldo." icone="caixa" />
        <Indicador titulo="Produtos em alerta" valor={noMinimo.toLocaleString("pt-BR")}
          descricao={`No mínimo ou abaixo · ${semEstoque} sem estoque`} icone="alerta" alerta />
        <Indicador titulo="Movimentações hoje" valor={movimentacoesHoje.toLocaleString("pt-BR")}
          descricao="Registros de entrada e saída no dia, em Brasília." icone="movimento" />
      </section>

      <section aria-labelledby="estoque-produtos-titulo" className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="space-y-4 border-b border-slate-200 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2 id="estoque-produtos-titulo" className="text-base font-semibold text-[#244b49]">Produtos em estoque</h2>
            <p aria-live="polite" aria-atomic="true" className="text-xs text-slate-500">
              {produtosFiltrados.length} de {produtos.length} produtos
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor={buscaId} className="mb-2 block text-sm font-medium text-slate-700">Buscar produto</label>
              <div className="relative min-w-0">
                <span className="pointer-events-none absolute left-3 top-3 text-slate-400"><Icone nome="busca" /></span>
                <input id={buscaId} type="search" value={busca} onChange={(event) => setBusca(event.target.value)}
                  placeholder="Nome, código ou cultura" className="input input-busca" />
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <button type="button" aria-expanded={mostrarFiltros} aria-controls={filtroId}
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${mostrarFiltros || filtrosAtivos ? "border-[#486d6b]/40 bg-[#edf4f3] text-[#244b49]" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
                <Icone nome="filtro" />
                Filtros
                {filtrosAtivos > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#486d6b] px-1 text-xs text-white">
                  <span className="sr-only">ativos: </span>{filtrosAtivos}
                </span>}
              </button>
              {possuiFiltro && <button type="button" onClick={limparFiltros}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#486d6b] hover:bg-[#edf4f3]">Limpar filtros</button>}
            </div>
          </div>
          <div id={filtroId} hidden={!mostrarFiltros} className="grid min-w-0 grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-2 block text-sm font-medium text-slate-700">Categoria</span>
              <select value={categoria} onChange={(event) => setCategoria(event.target.value)} className="input">
                <option value="">Todas as categorias</option>
                {categorias.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-2 block text-sm font-medium text-slate-700">Situação</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="input">
                <option value="">Todas as situações</option>
                <option value="NORMAL">Normal</option>
                <option value="BAIXO">No mínimo ou abaixo</option>
                <option value="SEM_ESTOQUE">Sem estoque</option>
              </select>
            </label>
          </div>
          {filtrosAtivos > 0 && <p className="text-xs leading-5 text-slate-500">
            Filtros aplicados: {[categoria, status === "BAIXO" ? "No mínimo ou abaixo" : status === "SEM_ESTOQUE" ? "Sem estoque" : status === "NORMAL" ? "Normal" : ""].filter(Boolean).join(" · ")}
          </p>}
        </header>

        {produtosFiltrados.length === 0 ? (
          <div className="p-4 sm:p-5">
            <div className="estado-vazio">
              <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#edf4f3] text-[#486d6b]">
                <Icone nome={produtos.length === 0 ? "caixa" : "busca"} />
              </span>
              <p className="font-medium text-slate-700">{produtos.length === 0 ? "Seu estoque ainda está vazio" : "Nenhum produto encontrado"}</p>
              <p className="mt-2 text-sm text-slate-500">{produtos.length === 0 ? "Cadastre o primeiro produto em Novo produto para começar." : "Tente outro nome, código ou cultura, ou limpe os filtros."}</p>
            </div>
          </div>
        ) : (
          <>
            <div tabIndex={0} role="region" aria-label="Tabela de produtos" className="hidden max-w-full overflow-x-auto lg:block">
              <table className="w-full min-w-[840px] table-fixed text-left text-sm">
                <caption className="sr-only">Produtos, categorias, saldos, mínimos, situação e ação de movimentação.</caption>
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="w-[30%] px-5 py-3 font-medium">Produto</th>
                    <th scope="col" className="w-[15%] px-4 py-3 text-right font-medium">Saldo atual</th>
                    <th scope="col" className="w-[15%] px-4 py-3 text-right font-medium">Estoque mínimo</th>
                    <th scope="col" className="w-[22%] px-4 py-3 font-medium">Situação</th>
                    <th scope="col" className="w-[18%] px-4 py-3 text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {produtosFiltrados.map((produto) => (
                    <tr key={produto.id_produto} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4"><Identificacao produto={produto} /></td>
                      <td className="break-words px-4 py-4 text-right font-medium tabular-nums text-slate-800">{numero(produto.quantidade)} <span className="text-xs font-normal text-slate-500">{unidade(produto.unidade_medida)}</span></td>
                      <td className="break-words px-4 py-4 text-right tabular-nums">{numero(produto.estoque_min)} <span className="text-xs text-slate-500">{unidade(produto.unidade_medida)}</span></td>
                      <td className="px-4 py-4"><Etiqueta produto={produto} /></td>
                      <td className="px-3 py-4 text-right"><AcaoMovimentar produto={produto} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 lg:hidden">
              {produtosFiltrados.map((produto) => (
                <li key={produto.id_produto} className="min-w-0 space-y-4 p-4 sm:p-5">
                  <Identificacao produto={produto} />
                  <dl className="grid min-w-0 grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">Saldo atual</dt>
                      <dd className="mt-1 break-words font-medium tabular-nums text-slate-800">{numero(produto.quantidade)} {unidade(produto.unidade_medida)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">Estoque mínimo</dt>
                      <dd className="mt-1 break-words tabular-nums">{numero(produto.estoque_min)} {unidade(produto.unidade_medida)}</dd>
                    </div>
                  </dl>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <Etiqueta produto={produto} />
                    <AcaoMovimentar produto={produto} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="border-t border-slate-100 px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5">
          Alerta: quantidade no mínimo ou abaixo. Os saldos mantêm a unidade cadastrada de cada produto.
        </p>
      </section>

      <details className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-4 py-4 text-sm font-medium text-[#244b49] sm:px-5">
          Movimentações recentes <span className="ml-1 text-xs font-normal text-slate-500">({movimentacoes.length})</span>
        </summary>
        <div className="border-t border-slate-100 px-4 pb-1 pt-3 sm:px-5">
          <p className="text-xs text-slate-500">Últimos 10 registros · horários de Brasília</p>
          {movimentacoes.length === 0 ? (
            <p className="py-5 text-sm text-slate-500">Nenhuma movimentação registrada.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {movimentacoes.map((movimento) => {
                const entrada = movimento.tipo === "ENTRADA";
                const saida = ["SAIDA", "SAÍDA"].includes(movimento.tipo);
                return (
                  <li key={movimento.id} className="min-w-0 py-3">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="min-w-0 break-words text-sm font-medium text-slate-800">{movimento.produto}</p>
                      <p className={`break-words text-sm font-medium tabular-nums ${entrada ? "text-[#486d6b]" : saida ? "text-red-700" : "text-slate-600"}`}>
                        {entrada ? "Entrada" : saida ? "Saída" : movimento.tipo} · {numero(movimento.quantidade)} {unidade(movimento.unidade)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {new Date(movimento.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })} · {movimento.responsavel}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{movimento.observacao || "Sem observação"}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}

function AcaoMovimentar({ produto }: { produto: ProdutoEstoque }) {
  return <MovimentacaoModal idProduto={produto.id_produto} nomeProduto={produto.nome_produto}
    quantidadeAtual={produto.quantidade} unidadeMedida={produto.unidade_medida}
    categoria={produto.categoria} estoqueMinimo={produto.estoque_min} />;
}

function Identificacao({ produto }: { produto: ProdutoEstoque }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf4f3] text-[#486d6b]">
        <Icone nome={produto.id_cultura !== null ? "planta" : "caixa"} />
      </span>
      <div className="min-w-0">
        <p className="break-words font-medium leading-5 text-slate-800">{produto.nome_produto}</p>
        <p className="mt-1 break-words text-xs leading-5 text-slate-500">
          {categoriaExibida(produto)}{produto.culturaNome ? ` · ${produto.culturaNome}` : ""}
        </p>
        <p className="text-xs leading-5 text-slate-500">Cód. {produto.id_produto}</p>
      </div>
    </div>
  );
}

function Etiqueta({ produto }: { produto: ProdutoEstoque }) {
  const config = {
    NORMAL: { texto: "Normal", classe: "border-[#486d6b]/15 bg-[#edf4f3] text-[#244b49]" },
    BAIXO: { texto: "No mínimo ou abaixo", classe: "border-amber-200 bg-amber-50 text-amber-800" },
    SEM_ESTOQUE: { texto: "Sem estoque", classe: "border-red-200 bg-red-50 text-red-700" },
  }[situacao(produto)];
  return <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium ${config.classe}`}>{config.texto}</span>;
}

function Indicador({ titulo, valor, descricao, icone, alerta = false }: {
  titulo: string; valor: string; descricao: string; icone: NomeIcone; alerta?: boolean;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h2 className="text-sm font-medium leading-5 text-slate-600">{titulo}</h2>
        <span className={`shrink-0 ${alerta ? "text-amber-600" : "text-[#486d6b]"}`}><Icone nome={icone} /></span>
      </div>
      <p className={`my-2 text-2xl font-semibold leading-8 tabular-nums ${alerta ? "text-amber-800" : "text-[#244b49]"}`}>{valor}</p>
      <p className="text-xs leading-5 text-slate-500">{descricao}</p>
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
