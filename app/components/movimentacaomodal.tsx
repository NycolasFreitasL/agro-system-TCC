"use client";

import {
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { incompatibilidadeDose, quantidadeInteira, usaDose } from "@/app/lib/estoque-regras";
import UiIcon from "@/app/components/ui-icon";

export type ProdutoMovimentacao = {
  categoria?: string;
  estoque_min?: number;
  id_produto: number;
  nome_produto: string;
  quantidade: number;
  unidade_medida: string;
};

type MovimentacaoModalProps =
  | {
      produtos: ProdutoMovimentacao[];
    }
  | {
      idProduto: number;
      nomeProduto: string;
      quantidadeAtual: number;
      unidadeMedida: string;
      categoria?: string;
      estoqueMinimo?: number;
    };

const campo = "input mt-1.5";

function numero(valor: number) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function unidadeFormatada(unidade: string) {
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

  return unidades[unidade.trim().toUpperCase()] ?? unidade;
}

export default function MovimentacaoModal(
  props: MovimentacaoModalProps,
) {
  const router = useRouter();
  const tituloId = useId();
  const descricaoId = useId();
  const quantidadeHintId = useId();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const enviandoRef = useRef(false);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const produtoRef = useRef<HTMLSelectElement>(null);
  const quantidadeRef = useRef<HTMLInputElement>(null);

  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const [produtoId, setProdutoId] = useState("");
  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA">(
    "ENTRADA",
  );
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");

  const geral = "produtos" in props;

  const produtos: ProdutoMovimentacao[] =
    "produtos" in props
      ? props.produtos
      : [
          {
            id_produto: props.idProduto,
            nome_produto: props.nomeProduto,
            quantidade: props.quantidadeAtual,
            unidade_medida: props.unidadeMedida,
            categoria: props.categoria,
            estoque_min: props.estoqueMinimo,
          },
        ];

  const produto = produtos.find(
    (item) => item.id_produto === Number(produtoId),
  );

  const quantidadeValida =
    /^\d{1,8}(\.\d{1,2})?$/.test(quantidade) &&
    Number(quantidade) > 0 &&
    Number(quantidade) <= 99999999.99 &&
    (!produto || !usaDose(produto.unidade_medida) || quantidadeInteira(quantidade));

  const incompatibilidade = produto ? incompatibilidadeDose(produto) : null;

  const quantidadeCentesimos = quantidadeValida
    ? Math.round(Number(quantidade) * 100)
    : 0;

  const saldoCentesimos = produto
    ? Math.round(produto.quantidade * 100)
    : 0;

  const saldoPrevistoCentesimos =
    tipo === "ENTRADA"
      ? saldoCentesimos + quantidadeCentesimos
      : saldoCentesimos - quantidadeCentesimos;

  const saldoInvalido =
    Boolean(produto) &&
    quantidadeValida &&
    (saldoPrevistoCentesimos < 0 ||
      saldoPrevistoCentesimos > 9999999999);

  function abrir() {
    setProdutoId(
      "produtos" in props ? "" : String(props.idProduto),
    );
    setTipo("ENTRADA");
    setQuantidade("");
    setObservacao("");
    setErro("");
    setAberto(true);
  }

  function fechar() {
    if (enviandoRef.current) {
      return;
    }

    setAberto(false);
    setErro("");
  }

  useEffect(() => {
    if (!aberto) {
      return;
    }

    const dialog = dialogRef.current;
    const botao = botaoRef.current;

    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    if (geral) {
      produtoRef.current?.focus();
    } else {
      quantidadeRef.current?.focus();
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowAnterior;

      if (dialog.open) {
        dialog.close();
      }

      if (botao?.isConnected) {
        botao.focus();
      }
    };
  }, [aberto, geral]);

  async function registrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (enviandoRef.current) {
      return;
    }

    if (incompatibilidade) {
      setErro(incompatibilidade);
      return;
    }

    if (!produto || !quantidadeValida) {
      setErro(
        "Selecione um produto e informe uma quantidade válida.",
      );
      return;
    }

    if (saldoInvalido) {
      setErro(
        tipo === "SAIDA"
          ? "A quantidade supera o saldo disponível."
          : "A entrada ultrapassa o limite de saldo permitido.",
      );
      return;
    }

    enviandoRef.current = true;
    setSalvando(true);
    setErro("");

    try {
      const resposta = await fetch(
        "/api/estoque/movimentacoes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idProduto: produto.id_produto,
            tipo,
            quantidade,
            observacao,
          }),
        },
      );

      if (
        !resposta.headers
          .get("content-type")
          ?.includes("application/json")
      ) {
        throw new Error(
          "Não foi possível processar a movimentação. Tente novamente.",
        );
      }

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.error ||
            "Não foi possível registrar a movimentação.",
        );
      }

      setAberto(false);
      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro inesperado.",
      );
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={abrir}
        disabled={produtos.length === 0}
        aria-label={geral ? "Registrar movimentação" : `Movimentar ${props.nomeProduto}`}
        className={
          geral
            ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#486d6b] transition hover:border-[#486d6b] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            : "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-[#486d6b] hover:bg-slate-50 hover:text-[#244b49]"
        }
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
          <path d="M4 7h14m-4-4 4 4-4 4M20 17H6m4-4-4 4 4 4" />
        </svg>
        {geral ? "Registrar movimentação" : "Movimentar"}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={tituloId}
        aria-describedby={descricaoId}
        onCancel={(event) => {
          event.preventDefault();
          fechar();
        }}
        onClose={() => {
          if (!enviandoRef.current) setAberto(false);
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[94vw] max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-950/45"
      >
        {aberto && (
          <>
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <h2 id={tituloId} className="text-xl font-semibold text-[#244b49]">
                  Registrar movimentação
                </h2>
                <p id={descricaoId} className="mt-1 text-sm text-slate-500">
                  Informe a entrada ou saída e confira o saldo previsto.
                </p>
              </div>

              <button
                type="button"
                onClick={fechar}
                disabled={salvando}
                aria-label="Fechar movimentação de estoque"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <UiIcon nome="fechar" />
              </button>
            </header>

            <form onSubmit={registrar} aria-busy={salvando} className="p-4 sm:p-6">
              <fieldset disabled={salvando} className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="min-w-0">
                  <div
                    role="group"
                    aria-label="Tipo de movimentação"
                    className="mb-4 grid grid-cols-2 gap-2"
                  >
                    {(["ENTRADA", "SAIDA"] as const).map(
                      (opcao) => (
                        <button
                          key={opcao}
                          type="button"
                          aria-pressed={tipo === opcao}
                          onClick={() => {
                            setTipo(opcao);
                            setErro("");
                          }}
                          className={
                            tipo === opcao
                              ? "min-h-11 rounded-xl border border-[#486d6b] bg-[#486d6b] px-3 py-2.5 text-sm font-semibold text-white"
                              : "min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                          }
                        >
                          {opcao === "ENTRADA" ? "Entrada" : "Saída"}
                        </button>
                      ),
                    )}
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-4">
                    <label className="block min-w-0">
                      <span className="text-sm font-medium text-slate-700">
                        Produto <span aria-hidden="true" className="ml-1 text-red-600">*</span>
                      </span>

                      <select
                        ref={produtoRef}
                        name="produto"
                        required
                        value={produtoId}
                        onChange={(event) => {
                          setProdutoId(event.target.value);
                          setErro("");
                        }}
                        disabled={!geral}
                        className={campo}
                      >
                        <option value="" disabled>
                          Selecione o produto
                        </option>

                        {produtos.map((item) => (
                          <option
                            key={item.id_produto}
                            value={item.id_produto}
                          >
                            {item.nome_produto}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block min-w-0">
                      <span className="text-sm font-medium text-slate-700">
                        Quantidade
                        {produto
                          ? ` (${unidadeFormatada(
                              produto.unidade_medida,
                            )})`
                          : ""}
                        <span aria-hidden="true" className="ml-1 text-red-600">*</span>
                      </span>

                      <input
                        ref={quantidadeRef}
                        name="quantidade"
                        aria-describedby={quantidadeHintId}
                        aria-invalid={saldoInvalido || Boolean(incompatibilidade)}
                        type="number"
                        required
                        min={produto && usaDose(produto.unidade_medida) ? "1" : "0.01"}
                        max={produto && usaDose(produto.unidade_medida) ? "99999999" : "99999999.99"}
                        step={produto && usaDose(produto.unidade_medida) ? "1" : "0.01"}
                        placeholder={produto && usaDose(produto.unidade_medida) ? "Ex.: 2 doses" : "0,00"}
                        value={quantidade}
                        onChange={(event) => {
                          setQuantidade(event.target.value);
                          setErro("");
                        }}
                        className={campo}
                      />
                      <span id={quantidadeHintId} className="mt-1.5 block text-xs text-slate-500">
                        {produto && usaDose(produto.unidade_medida)
                          ? "Informe um número inteiro maior que zero."
                          : "Informe uma quantidade maior que zero, com até duas casas decimais."}
                      </span>
                    </label>

                    <label className="block min-w-0">
                      <span className="text-sm font-medium text-slate-700">
                        Observação <span className="font-normal text-slate-500">(opcional)</span>
                      </span>

                      <textarea
                        name="observacao"
                        rows={3}
                        maxLength={255}
                        placeholder="Informe o motivo da entrada ou saída."
                        value={observacao}
                        onChange={(event) =>
                          setObservacao(event.target.value)
                        }
                        className={`${campo} resize-y`}
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Plantios e colheitas já atualizam o estoque. Use este formulário para movimentações manuais.
                  </p>
                </div>

                <section className="min-w-0 self-start rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-[#244b49]">Resumo da movimentação</h3>

                  <dl className="mt-3 grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2 md:grid-cols-1">
                    <Resumo
                      titulo="Tipo"
                      valor={tipo === "ENTRADA" ? "Entrada" : "Saída"}
                    />

                    <Resumo
                      titulo="Produto"
                      valor={produto?.nome_produto ?? "Não selecionado"}
                    />

                    <Resumo
                      titulo="Saldo atual"
                      valor={
                        produto
                          ? `${numero(produto.quantidade)} ${unidadeFormatada(
                              produto.unidade_medida,
                            )}`
                          : "—"
                      }
                    />

                    <Resumo
                      titulo="Quantidade informada"
                      valor={
                        produto && quantidadeValida
                          ? `${numero(
                              quantidadeCentesimos / 100,
                            )} ${unidadeFormatada(produto.unidade_medida)}`
                          : "—"
                      }
                    />

                    <div className="min-w-0 border-t border-slate-200 pt-3 sm:col-span-2 md:col-span-1">
                      <dt className="text-slate-500">
                        Saldo previsto após a movimentação
                      </dt>

                      <dd
                        aria-live="polite"
                        aria-atomic="true"
                        className={`mt-1 break-words text-xl font-semibold tabular-nums ${
                          saldoInvalido
                            ? "text-red-700"
                            : "text-[#244b49]"
                        }`}
                      >
                        {produto && quantidadeValida && !incompatibilidade
                          ? `${numero(
                              saldoPrevistoCentesimos / 100,
                            )} ${unidadeFormatada(produto.unidade_medida)}`
                          : "—"}
                      </dd>

                      <p className="mt-1 text-xs text-slate-500">
                        O saldo será conferido novamente ao salvar.
                      </p>
                    </div>

                    {observacao.trim() && (
                      <div className="min-w-0 sm:col-span-2 md:col-span-1">
                        <dt className="text-slate-500">Observação</dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words">
                          {observacao.trim()}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>
              </fieldset>

              {incompatibilidade && (
                <p role="alert" className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                  {incompatibilidade}
                </p>
              )}

              {saldoInvalido && (
                <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {tipo === "SAIDA" ? "A quantidade supera o saldo disponível." : "A entrada ultrapassa o limite de saldo permitido."}
                </p>
              )}

              {erro && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700"
                >
                  {erro}
                </p>
              )}

              <footer className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={fechar}
                  disabled={salvando}
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    salvando ||
                    !produto ||
                    !quantidadeValida ||
                    saldoInvalido ||
                    Boolean(incompatibilidade)
                  }
                  className="min-h-11 rounded-xl bg-[#486d6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#244b49] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {salvando ? "Registrando..." : "Registrar movimentação"}
                </button>
              </footer>
            </form>
          </>
        )}
      </dialog>
    </>
  );
}

function Resumo({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{titulo}</dt>
      <dd className="mt-1 break-words font-medium tabular-nums text-slate-700">{valor}</dd>
    </div>
  );
}
