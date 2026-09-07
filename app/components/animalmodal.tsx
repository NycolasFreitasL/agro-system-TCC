"use client";

import {
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Especie = {
  id_especie: number;
  nome_especie: string;
};

type AnimalModalProps = {
  especies: Especie[];
};

type CampoProps = {
  titulo: string;
  obrigatorio?: boolean;
  children: ReactNode;
};

export default function AnimalModal({
  especies,
}: AnimalModalProps) {
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

  async function cadastrarAnimal(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formulario = event.currentTarget;
    const formData = new FormData(formulario);

    setCarregando(true);
    setErro("");

    try {
      const resposta = await fetch("/api/animais", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          nome: formData.get("nome"),
          especie: formData.get("especie"),
          raca: formData.get("raca"),
          sexo: formData.get("sexo"),
          nascimento: formData.get("nascimento"),
          peso: formData.get("peso"),
          saude: formData.get("saude"),
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.error ||
            "Não foi possível cadastrar o animal.",
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
        + Novo animal
      </button>

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={fecharModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-animal"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
                  Pecuária
                </p>

                <h2
                  id="titulo-modal-animal"
                  className="mt-1 text-2xl font-bold text-slate-900"
                >
                  Cadastrar novo animal
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Adicione um animal ao rebanho.
                </p>
              </div>

              <button
                type="button"
                aria-label="Fechar modal"
                onClick={fecharModal}
                disabled={carregando}
                className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                ×
              </button>
            </header>

            <form
              onSubmit={cadastrarAnimal}
              className="p-6"
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Campo
                  titulo="Nome do animal"
                  obrigatorio
                >
                  <input
                    name="nome"
                    required
                    maxLength={100}
                    placeholder="Ex.: Estrela"
                    className="input"
                  />
                </Campo>

                <Campo titulo="Espécie" obrigatorio>
                  <select
                    name="especie"
                    required
                    defaultValue=""
                    className="input"
                  >
                    <option value="" disabled>
                      Selecione a espécie
                    </option>

                    {especies.map((especie) => (
                      <option
                        key={especie.id_especie}
                        value={especie.id_especie}
                      >
                        {especie.nome_especie}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo titulo="Raça">
                  <input
                    name="raca"
                    maxLength={60}
                    placeholder="Ex.: Nelore"
                    className="input"
                  />
                </Campo>

                <Campo titulo="Sexo" obrigatorio>
                  <select
                    name="sexo"
                    required
                    defaultValue=""
                    className="input"
                  >
                    <option value="" disabled>
                      Selecione o sexo
                    </option>

                    <option value="M">Macho</option>
                    <option value="F">Fêmea</option>
                  </select>
                </Campo>

                <Campo titulo="Data de nascimento">
                  <input
                    name="nascimento"
                    type="date"
                    className="input"
                  />
                </Campo>

                <Campo titulo="Peso atual">
                  <div className="relative">
                    <input
                      name="peso"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      className="input pr-12"
                    />

                    <span className="pointer-events-none absolute right-4 top-3 text-sm text-slate-400">
                      kg
                    </span>
                  </div>
                </Campo>

                <Campo titulo="Condição de saúde">
                  <select
                    name="saude"
                    defaultValue="SAUDÁVEL"
                    className="input"
                  >
                    <option value="SAUDÁVEL">
                      Saudável
                    </option>

                    <option value="EM OBSERVAÇÃO">
                      Em observação
                    </option>

                    <option value="EM TRATAMENTO">
                      Em tratamento
                    </option>
                  </select>
                </Campo>
              </div>

              {especies.length === 0 && (
                <p className="mt-6 rounded-xl bg-yellow-50 p-4 text-sm font-medium text-yellow-800">
                  Não existem espécies ativas cadastradas.
                </p>
              )}

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
                  className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    carregando ||
                    especies.length === 0
                  }
                  className="rounded-xl bg-green-800 px-6 py-3 font-semibold text-white transition hover:bg-green-900 disabled:cursor-wait disabled:opacity-60"
                >
                  {carregando
                    ? "Cadastrando..."
                    : "Cadastrar animal"}
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