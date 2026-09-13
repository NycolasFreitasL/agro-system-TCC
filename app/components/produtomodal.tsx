"use client";

import {
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type CampoProps = {
  titulo: string;
  obrigatorio?: boolean;
  children: ReactNode;
};

export default function ProdutoModal() {
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

  async function cadastrarProduto(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formulario = event.currentTarget;
    const formData = new FormData(formulario);

    setCarregando(true);
    setErro("");

    try {
      const resposta = await fetch("/api/estoque/produtos", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          nome: formData.get("nome"),
          categoria: formData.get("categoria"),
          quantidade: formData.get("quantidade"),
          estoqueMinimo: formData.get("estoqueMinimo"),
          unidadeMedida: formData.get("unidadeMedida"),
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.error ||
            "Não foi possível cadastrar o produto.",
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
        className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900"
      >
        + Novo produto
      </button>

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={fecharModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-produto"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
                  Estoque
                </p>

                <h2
                  id="titulo-modal-produto"
                  className="mt-1 text-2xl font-bold text-slate-900"
                >
                  Cadastrar produto
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Adicione um novo item ao estoque.
                </p>
              </div>

              <button
                type="button"
                aria-label="Fechar modal"
                onClick={fecharModal}
                disabled={carregando}
                className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                ×
              </button>
            </header>

            <form
              onSubmit={cadastrarProduto}
              className="p-6"
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Campo
                    titulo="Nome do produto"
                    obrigatorio
                  >
                    <input
                      name="nome"
                      required
                      maxLength={100}
                      placeholder="Ex.: Ração bovina"
                      className="input"
                    />
                  </Campo>
                </div>

                <Campo titulo="Categoria" obrigatorio>
                  <select
                    name="categoria"
                    required
                    defaultValue=""
                    className="input"
                  >
                    <option value="" disabled>
                      Selecione a categoria
                    </option>

                    <option value="Alimentação">
                      Alimentação
                    </option>

                    <option value="Fertilizante">
                        Fertilizante
                    </option>

                    <option value="Semente">
                      Semente
                    </option>

                    <option value="Vacina">
                      Vacina
                    </option>

                    <option value="Medicamento">
                      Medicamento
                    </option>

                    <option value="Ferramenta">
                      Ferramenta
                    </option>

                    <option value="Outro">
                      Outro
                    </option>
                  </select>
                </Campo>

                <Campo
                  titulo="Unidade de medida"
                  obrigatorio
                >
                  <select
                    name="unidadeMedida"
                    required
                    defaultValue=""
                    className="input"
                  >
                    <option value="" disabled>
                      Selecione a unidade
                    </option>

                    <option value="KG">Quilograma (kg)</option>
                    <option value="G">Grama (g)</option>
                    <option value="L">Litro (L)</option>
                    <option value="ML">Mililitro (ml)</option>
                    <option value="Unidade">
                      Unidade
                    </option>
                    <option value="Saca">Saca</option>
                    <option value="Dose">Dose</option>
                  </select>
                </Campo>

                <Campo
                  titulo="Quantidade inicial"
                  obrigatorio
                >
                  <input
                    name="quantidade"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    defaultValue="0"
                    className="input"
                  />
                </Campo>

                <Campo
                  titulo="Estoque mínimo"
                  obrigatorio
                >
                  <input
                    name="estoqueMinimo"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    defaultValue="0"
                    className="input"
                  />
                </Campo>
              </div>

              {erro && (
                <p
                  role="alert"
                  className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700"
                >
                  {erro}
                </p>
              )}

              <footer className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={carregando}
                  className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={carregando}
                  className="rounded-xl bg-green-800 px-6 py-3 font-semibold text-white hover:bg-green-900 disabled:cursor-wait disabled:opacity-60"
                >
                  {carregando
                    ? "Cadastrando..."
                    : "Cadastrar produto"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Campo({
  titulo,
  obrigatorio = false,
  children,
}: CampoProps) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">
        {titulo}

        {obrigatorio && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>

      <div className="mt-2">{children}</div>
    </label>
  );
}