"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Cultura = {
  id_cultura: number;
  nome_cultura: string;
};

type CampoProps = {
  titulo: string;
  obrigatorio?: boolean;
  children: ReactNode;
};

const CATEGORIAS = [
  "Alimentação",
  "Fertilizante",
  "Semente",
  "Produto colhido",
  "Vacina",
  "Medicamento",
  "Ferramenta",
  "Outro",
];

const UNIDADES = [
  { valor: "KG", nome: "Quilograma (kg)" },
  { valor: "G", nome: "Grama (g)" },
  { valor: "L", nome: "Litro (L)" },
  { valor: "ML", nome: "Mililitro (ml)" },
  { valor: "UNIDADE", nome: "Unidade" },
  { valor: "SACA", nome: "Saca" },
  { valor: "DOSE", nome: "Dose" },
];

export default function ProdutoModal() {
  const router = useRouter();
  const tituloId = useId();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const enviandoRef = useRef(false);

  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [categoria, setCategoria] = useState("");
  const [unidade, setUnidade] = useState("");

  const [culturas, setCulturas] = useState<Cultura[]>([]);
  const [buscandoCulturas, setBuscandoCulturas] =
    useState(false);
  const [erroCulturas, setErroCulturas] = useState("");

  const exigeCultura =
    categoria === "Semente" ||
    categoria === "Produto colhido";

  const unidadesDisponiveis = UNIDADES.filter((item) => {
    if (categoria === "Produto colhido") {
      return item.valor === "KG";
    }

    if (categoria === "Semente") {
      return ["KG", "SACA", "UNIDADE"].includes(
        item.valor,
      );
    }

    return true;
  });

  const culturaIndisponivel =
    exigeCultura &&
    (buscandoCulturas ||
      Boolean(erroCulturas) ||
      culturas.length === 0);

  function abrirModal() {
    setErro("");
    setErroCulturas("");
    setCategoria("");
    setUnidade("");
    setCulturas([]);
    setBuscandoCulturas(true);
    setModalAberto(true);
  }

  function fecharModal() {
    if (enviandoRef.current) {
      return;
    }

    setErro("");
    setModalAberto(false);
  }

  function alterarCategoria(novaCategoria: string) {
    setCategoria(novaCategoria);
    setErro("");

    if (
      novaCategoria === "Semente" ||
      novaCategoria === "Produto colhido"
    ) {
      setUnidade("KG");
    } else {
      setUnidade("");
    }
  }

  useEffect(() => {
    if (!modalAberto) {
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    const overflowAnterior =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowAnterior;

      if (dialog.open) {
        dialog.close();
      }
    };
  }, [modalAberto]);

  useEffect(() => {
    if (!modalAberto) {
      return;
    }

    const controller = new AbortController();

    async function carregarCulturas() {
      setBuscandoCulturas(true);
      setErroCulturas("");

      try {
        const resposta = await fetch(
          "/api/estoque/produtos",
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (
          !resposta.headers
            .get("content-type")
            ?.includes("application/json")
        ) {
          throw new Error(
            "Não foi possível consultar as culturas.",
          );
        }

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.error ||
              "Não foi possível consultar as culturas.",
          );
        }

        if (!Array.isArray(dados.culturas)) {
          throw new Error(
            "A consulta de culturas retornou dados inválidos.",
          );
        }

        if (!controller.signal.aborted) {
          setCulturas(dados.culturas);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setErroCulturas(
            error instanceof Error
              ? error.message
              : "Erro ao carregar as culturas.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setBuscandoCulturas(false);
        }
      }
    }

    void carregarCulturas();

    return () => {
      controller.abort();
    };
  }, [modalAberto]);

  async function cadastrarProduto(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      enviandoRef.current ||
      culturaIndisponivel
    ) {
      return;
    }

    const formulario = event.currentTarget;
    const formData = new FormData(formulario);

    enviandoRef.current = true;
    setCarregando(true);
    setErro("");

    try {
      const resposta = await fetch(
        "/api/estoque/produtos",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nome: formData.get("nome"),
            categoria,
            unidadeMedida: unidade,
            quantidade: formData.get("quantidade"),
            estoqueMinimo: formData.get("estoqueMinimo"),
            idCultura: exigeCultura
              ? formData.get("idCultura")
              : null,
          }),
        },
      );

      if (
        !resposta.headers
          .get("content-type")
          ?.includes("application/json")
      ) {
        throw new Error(
          "A API de produtos não respondeu corretamente.",
        );
      }

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
      enviandoRef.current = false;
      setCarregando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrirModal}
        className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900"
      >
        + Novo produto
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={tituloId}
        onCancel={(event) => {
          event.preventDefault();
          fecharModal();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[92vw] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        {modalAberto && (
          <>
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:p-6">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
                  Estoque
                </p>

                <h2
                  id={tituloId}
                  className="mt-1 text-2xl font-bold"
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
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                ×
              </button>
            </header>

            <form
              onSubmit={cadastrarProduto}
              className="p-5 sm:p-6"
            >
              <fieldset
                disabled={carregando}
                className="min-w-0"
              >
                <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="min-w-0 sm:col-span-2">
                    <Campo
                      titulo="Nome do produto"
                      obrigatorio
                    >
                      <input
                        name="nome"
                        required
                        maxLength={100}
                        placeholder="Ex.: Semente de Milho"
                        className="input w-full min-w-0"
                      />
                    </Campo>
                  </div>

                  <Campo titulo="Categoria" obrigatorio>
                    <select
                      name="categoria"
                      required
                      value={categoria}
                      onChange={(event) =>
                        alterarCategoria(
                          event.target.value,
                        )
                      }
                      className="input w-full min-w-0"
                    >
                      <option value="" disabled>
                        Selecione a categoria
                      </option>

                      {CATEGORIAS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </Campo>

                  <Campo
                    titulo="Unidade de medida"
                    obrigatorio
                  >
                    <select
                      name="unidadeMedida"
                      required
                      value={unidade}
                      onChange={(event) =>
                        setUnidade(event.target.value)
                      }
                      className="input w-full min-w-0"
                    >
                      <option value="" disabled>
                        Selecione a unidade
                      </option>

                      {unidadesDisponiveis.map((item) => (
                        <option
                          key={item.valor}
                          value={item.valor}
                        >
                          {item.nome}
                        </option>
                      ))}
                    </select>
                  </Campo>

                  {exigeCultura && (
                    <div className="min-w-0 sm:col-span-2">
                      <Campo
                        titulo="Cultura vinculada"
                        obrigatorio
                      >
                        <select
                          key={categoria}
                          name="idCultura"
                          required
                          defaultValue=""
                          disabled={
                            buscandoCulturas ||
                            Boolean(erroCulturas) ||
                            culturas.length === 0
                          }
                          className="input w-full min-w-0 disabled:bg-slate-100"
                        >
                          <option value="" disabled>
                            {buscandoCulturas
                              ? "Carregando culturas..."
                              : "Selecione a cultura"}
                          </option>

                          {culturas.map((cultura) => (
                            <option
                              key={cultura.id_cultura}
                              value={cultura.id_cultura}
                            >
                              {cultura.nome_cultura}
                            </option>
                          ))}
                        </select>
                      </Campo>

                      {erroCulturas && (
                        <p
                          role="alert"
                          className="mt-2 text-sm text-red-700"
                        >
                          {erroCulturas} Feche e abra o
                          formulário para tentar novamente.
                        </p>
                      )}

                      {!buscandoCulturas &&
                        !erroCulturas &&
                        culturas.length === 0 && (
                          <p className="mt-2 text-sm text-amber-700">
                            Nenhuma cultura ativa encontrada.
                            É necessário cadastrar ou ativar
                            uma cultura primeiro.
                          </p>
                        )}

                      <p className="mt-2 text-sm text-slate-500">
                        {categoria === "Semente"
                          ? "Essa cultura identifica o que será cultivado ao utilizar a semente no plantio."
                          : "Esse produto poderá receber as colheitas dos plantios da cultura selecionada."}
                      </p>
                    </div>
                  )}

                  {categoria === "Produto colhido" && (
                    <div className="rounded-xl bg-green-50 p-4 text-sm text-green-900 sm:col-span-2">
                      O estoque será controlado em kg.
                      Colheitas informadas em toneladas
                      serão convertidas automaticamente.
                    </div>
                  )}

                  <Campo
                    titulo="Quantidade inicial"
                    obrigatorio
                  >
                    <input
                      name="quantidade"
                      type="number"
                      required
                      min="0"
                      max="99999999.99"
                      step="0.01"
                      defaultValue="0"
                      className="input w-full min-w-0"
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
                      max="99999999.99"
                      step="0.01"
                      defaultValue="0"
                      className="input w-full min-w-0"
                    />
                  </Campo>

                  <p className="text-sm text-slate-500 sm:col-span-2">
                    A quantidade inicial representa o saldo
                    que já existe no estoque. Se for maior
                    que zero, será registrada uma entrada no
                    histórico.
                  </p>
                </div>
              </fieldset>

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
                  disabled={
                    carregando || culturaIndisponivel
                  }
                  className="rounded-xl bg-green-800 px-6 py-3 font-semibold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {carregando
                    ? "Cadastrando..."
                    : "Cadastrar produto"}
                </button>
              </footer>
            </form>
          </>
        )}
      </dialog>
    </>
  );
}

function Campo({
  titulo,
  obrigatorio = false,
  children,
}: CampoProps) {
  return (
    <label className="block min-w-0">
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