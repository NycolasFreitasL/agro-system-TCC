"use client";

import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type MovimentacaoModalProps = {
  idProduto: number;
  nomeProduto: string;
  quantidadeAtual: number;
  unidadeMedida: string;
};

export default function MovimentacaoModal({
  idProduto,
  nomeProduto,
  quantidadeAtual,
  unidadeMedida,
}: MovimentacaoModalProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const router = useRouter();

  function fecharModal() {
    if (carregando) {
      return;
    }

    setErro("");
    setModalAberto(false);
  }

  async function registrarMovimentacao(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formulario = event.currentTarget;
    const formData = new FormData(formulario);

    setCarregando(true);
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
            idProduto,
            tipo: formData.get("tipo"),
            quantidade: formData.get("quantidade"),
            observacao: formData.get("observacao"),
          }),
        },
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.error ||
            "Não foi possível registrar a movimentação.",
        );
      }

      formulario.reset();
      setModalAberto(false);
      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro inesperado.",
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        fecharModal();
      }
    }

    if (modalAberto) {
      window.addEventListener(
        "keydown",
        fecharComEscape,
      );
    }

    return () => {
      window.removeEventListener(
        "keydown",
        fecharComEscape,
      );
    };
  }, [modalAberto, carregando]);

  useEffect(() => {
    document.body.style.overflow = modalAberto
      ? "hidden"
      : "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [modalAberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalAberto(true)}
        className="font-semibold text-green-700 hover:text-green-900"
      >
        Movimentar
      </button>

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={fecharModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-movimentacao"
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <header className="flex items-start justify-between border-b border-slate-200 p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
                  Movimentação de estoque
                </p>

                <h2
                  id="titulo-movimentacao"
                  className="mt-1 text-2xl font-bold text-slate-900"
                >
                  {nomeProduto}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Saldo atual:{" "}
                  <strong className="text-slate-700">
                    {quantidadeAtual.toFixed(2)}{" "}
                    {unidadeMedida}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={fecharModal}
                disabled={carregando}
                aria-label="Fechar modal"
                className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </header>

            <form
              onSubmit={registrarMovimentacao}
              className="p-6"
            >
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Tipo de movimentação
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </span>

                <select
                  name="tipo"
                  required
                  defaultValue=""
                  className="input mt-2"
                >
                  <option value="" disabled>
                    Selecione o tipo
                  </option>

                  <option value="ENTRADA">
                    Entrada
                  </option>

                  <option value="SAIDA">
                    Saída
                  </option>
                </select>
              </label>

              <label className="mt-5 block">
                <span className="text-sm font-semibold text-slate-700">
                  Quantidade
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </span>

                <div className="relative mt-2">
                  <input
                    name="quantidade"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0,00"
                    className="input pr-20"
                  />

                  <span className="pointer-events-none absolute right-4 top-3 text-sm text-slate-400">
                    {unidadeMedida}
                  </span>
                </div>
              </label>

              <label className="mt-5 block">
                <span className="text-sm font-semibold text-slate-700">
                  Observação
                </span>

                <textarea
                  name="observacao"
                  maxLength={255}
                  rows={3}
                  placeholder="Motivo ou detalhe da movimentação"
                  className="input mt-2 resize-none"
                />
              </label>

              {erro && (
                <p
                  role="alert"
                  className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700"
                >
                  {erro}
                </p>
              )}

              <footer className="mt-7 flex justify-end gap-3 border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={carregando}
                  className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={carregando}
                  className="rounded-xl bg-green-800 px-6 py-3 font-semibold text-white hover:bg-green-900 disabled:cursor-wait disabled:opacity-60"
                >
                  {carregando
                    ? "Registrando..."
                    : "Confirmar movimentação"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}