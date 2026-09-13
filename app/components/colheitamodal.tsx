"use client";

import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type ColheitaModalProps = {
  idPlantio: number;
  nomeCultura: string;
  nomeLote: string;
};

export default function ColheitaModal({
  idPlantio,
  nomeCultura,
  nomeLote,
}: ColheitaModalProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const router = useRouter();

  function fecharModal() {
    if (carregando) return;

    setErro("");
    setModalAberto(false);
  }

  async function registrarColheita(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formulario = event.currentTarget;
    const formData = new FormData(formulario);

    setCarregando(true);
    setErro("");

    try {
      const resposta = await fetch("/api/colheitas", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          idPlantio,
          data: formData.get("data"),
          quantidade: formData.get("quantidade"),
          unidade: formData.get("unidade"),
          observacao: formData.get("observacao"),
        }),
      });

      const tipoResposta =
        resposta.headers.get("content-type");

      if (
        !tipoResposta?.includes("application/json")
      ) {
        throw new Error(
          "A API de colheitas não respondeu corretamente.",
        );
      }

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.error ||
            "Não foi possível registrar a colheita.",
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

  return (
    <>
      <button
        type="button"
        onClick={() => setModalAberto(true)}
        className="font-semibold text-green-700 hover:text-green-900"
      >
        Registrar colheita
      </button>

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={fecharModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <header className="flex items-start justify-between border-b border-slate-200 p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
                  Colheita
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {nomeCultura}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {nomeLote}
                </p>
              </div>

              <button
                type="button"
                onClick={fecharModal}
                disabled={carregando}
                className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </header>

            <form
              onSubmit={registrarColheita}
              className="space-y-5 p-6"
            >
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Data da colheita *
                </span>

                <input
                  name="data"
                  type="date"
                  required
                  className="input mt-2"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    Quantidade *
                  </span>

                  <input
                    name="quantidade"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    className="input mt-2"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    Unidade *
                  </span>

                  <select
                    name="unidade"
                    required
                    defaultValue="KG"
                    className="input mt-2"
                  >
                    <option value="KG">kg</option>
                    <option value="TONELADA">
                      Tonelada
                    </option>
                    <option value="SACA">Saca</option>
                    <option value="UNIDADE">
                      Unidade
                    </option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Observação
                </span>

                <textarea
                  name="observacao"
                  rows={3}
                  maxLength={255}
                  className="input mt-2 resize-none"
                  placeholder="Qualidade, destino ou observações"
                />
              </label>

              {erro && (
                <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
                  {erro}
                </p>
              )}

              <footer className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={carregando}
                  className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-600"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={carregando}
                  className="rounded-xl bg-green-800 px-6 py-3 font-semibold text-white hover:bg-green-900 disabled:opacity-50"
                >
                  {carregando
                    ? "Registrando..."
                    : "Registrar colheita"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}