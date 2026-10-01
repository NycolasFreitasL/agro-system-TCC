"use client";

import {
  type FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export type ProdutoMovimentacao = {
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
    };

const campo =
  "mt-2 w-full min-w-0 rounded-lg border border-slate-300 " +
  "bg-white px-3 py-2.5 text-sm text-slate-800 outline-none " +
  "focus:border-[#486d6b] focus:ring-2 focus:ring-[#486d6b]/15";

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

  const dialogRef = useRef<HTMLDialogElement>(null);
  const enviandoRef = useRef(false);

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
          },
        ];

  const produto = produtos.find(
    (item) => item.id_produto === Number(produtoId),
  );

  const quantidadeValida =
    /^\d{1,8}(\.\d{1,2})?$/.test(quantidade) &&
    Number(quantidade) > 0 &&
    Number(quantidade) <= 99999999.99;

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

    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowAnterior;

      if (dialog.open) {
        dialog.close();
      }
    };
  }, [aberto]);

  async function registrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (enviandoRef.current) {
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
        type="button"
        onClick={abrir}
        disabled={produtos.length === 0}
        className={
          geral
            ? "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#486d6b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#365553] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            : "font-semibold text-[#486d6b] hover:text-[#123e40]"
        }
      >
        {geral ? "Registrar movimentação" : "Movimentar"}

        {geral && (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={tituloId}
        onCancel={(event) => {
          event.preventDefault();
          fechar();
        }}
        className="fixed inset-0 m-auto max-h-[92dvh] w-[94vw] max-w-3xl overflow-y-auto rounded-2xl border-0 bg-[#f5f5f5] p-0 text-slate-800 shadow-2xl backdrop:bg-black/50"
      >
        {aberto && (
          <>
            <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-[#f5f5f5] p-5 sm:px-7">
              <h2
                id={tituloId}
                className="text-xl font-bold sm:text-2xl"
              >
                Registrar movimentação
              </h2>

              <button
                type="button"
                onClick={fechar}
                disabled={salvando}
                aria-label="Fechar modal"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-50"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                >
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </header>

            <form onSubmit={registrar} className="p-5 sm:p-7">
              <fieldset disabled={salvando} className="min-w-0">
                <div
                  role="group"
                  aria-label="Tipo de movimentação"
                  className="mb-5 grid grid-cols-2 gap-3 sm:gap-6"
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
                            ? "rounded-lg border border-[#486d6b] bg-[#486d6b] px-4 py-2.5 font-semibold text-white"
                            : "rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-500 hover:bg-slate-50"
                        }
                      >
                        {opcao === "ENTRADA" ? "Entrada" : "Saída"}
                      </button>
                    ),
                  )}
                </div>

                <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
                  <p className="mb-5 text-sm text-slate-500">
                    Use para movimentações manuais. Plantios e
                    colheitas registrados no sistema já atualizam
                    o estoque automaticamente.
                  </p>

                  <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="text-sm font-semibold">
                        Produto
                      </span>

                      <select
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
                      <span className="text-sm font-semibold">
                        Quantidade
                        {produto
                          ? ` (${unidadeFormatada(
                              produto.unidade_medida,
                            )})`
                          : ""}
                      </span>

                      <input
                        type="number"
                        required
                        min="0.01"
                        max="99999999.99"
                        step="0.01"
                        placeholder="0,00"
                        value={quantidade}
                        onChange={(event) => {
                          setQuantidade(event.target.value);
                          setErro("");
                        }}
                        className={campo}
                      />
                    </label>

                    <label className="block min-w-0 sm:col-span-2">
                      <span className="text-sm font-semibold">
                        Observação
                      </span>

                      <textarea
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
                </div>

                <section className="mt-5 rounded-xl bg-white p-4 shadow-sm sm:p-5">
                  <h3 className="text-lg font-bold">Resumo</h3>

                  <dl className="mt-4 grid min-w-0 grid-cols-1 gap-4 text-sm sm:grid-cols-2">
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

                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">
                        Saldo previsto após a movimentação
                      </dt>

                      <dd
                        className={`mt-1 text-xl font-bold ${
                          saldoInvalido
                            ? "text-red-700"
                            : "text-[#123e40]"
                        }`}
                      >
                        {produto && quantidadeValida
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
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="text-slate-500">Observação</dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words">
                          {observacao.trim()}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>
              </fieldset>

              {erro && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700"
                >
                  {erro}
                </p>
              )}

              <footer className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={fechar}
                  disabled={salvando}
                  className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    salvando ||
                    !produto ||
                    !quantidadeValida ||
                    saldoInvalido
                  }
                  className="rounded-lg bg-[#486d6b] px-6 py-3 text-sm font-semibold text-white hover:bg-[#365553] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {salvando ? "Registrando..." : "Registrar"}
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
      <dd className="mt-1 break-words font-semibold">{valor}</dd>
    </div>
  );
}