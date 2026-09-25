"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Lote = {
  id_lote: number;
  nome_lote: string;
  area: number;
};

type Produto = {
  id_produto: number;
  nome_produto: string;
  unidade_medida: string;
};

type PlantioModalProps = {
  lotes: Lote[];
  produtos: Produto[];
};

export default function PlantioModal({
  lotes,
  produtos,
}: PlantioModalProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [idLote, setIdLote] = useState("");
  const [idProduto, setIdProduto] = useState("");

  const router = useRouter();

  const loteSelecionado = lotes.find(
    (lote) => lote.id_lote === Number(idLote),
  );

  const produtoSelecionado = produtos.find(
    (produto) => produto.id_produto === Number(idProduto),
  );

  function fecharModal() {
    if (carregando) return;

    setErro("");
    setIdLote("");
    setIdProduto("");
    setModalAberto(false);
  }

  async function cadastrarPlantio(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formulario = event.currentTarget;
    const formData = new FormData(formulario);

    setCarregando(true);
    setErro("");

    try {
      const resposta = await fetch("/api/plantios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idLote: formData.get("lote"),
          idProduto: formData.get("produto"),
          dataPlantio: formData.get("dataPlantio"),
          previsaoColheita: formData.get("previsaoColheita"),
          quantidade: formData.get("quantidade"),
          areaPlantada: formData.get("areaPlantada"),
        }),
      });

      const tipoResposta = resposta.headers.get("content-type");

      if (!tipoResposta?.includes("application/json")) {
        throw new Error(
          "A API de plantios não respondeu corretamente.",
        );
      }

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.error || "Não foi possível cadastrar o plantio.",
        );
      }

      formulario.reset();
      setIdLote("");
      setIdProduto("");
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
    if (!modalAberto) return;

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !carregando) {
        setErro("");
        setIdLote("");
        setIdProduto("");
        setModalAberto(false);
      }
    }

    window.addEventListener("keydown", fecharComEscape);

    return () => {
      window.removeEventListener("keydown", fecharComEscape);
    };
  }, [modalAberto, carregando]);

  useEffect(() => {
    if (!modalAberto) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [modalAberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalAberto(true)}
        className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white hover:bg-green-900"
      >
        + Novo plantio
      </button>

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={fecharModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-plantio"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between border-b border-slate-200 p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
                  Agricultura
                </p>

                <h2
                  id="titulo-modal-plantio"
                  className="mt-1 text-2xl font-bold text-slate-900"
                >
                  Cadastrar plantio
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Registre a semente e a área utilizada no lote.
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

            <form onSubmit={cadastrarPlantio} className="p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Campo titulo="Lote" obrigatorio>
                  <select
                    name="lote"
                    required
                    value={idLote}
                    onChange={(event) => setIdLote(event.target.value)}
                    className="input"
                  >
                    <option value="" disabled>
                      Selecione o lote
                    </option>

                    {lotes.map((lote) => (
                      <option
                        key={lote.id_lote}
                        value={lote.id_lote}
                      >
                        {lote.nome_lote} — {lote.area.toFixed(2)} ha
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo titulo="Semente" obrigatorio>
                  <select
                    name="produto"
                    required
                    value={idProduto}
                    onChange={(event) => setIdProduto(event.target.value)}
                    className="input"
                  >
                    <option value="" disabled>
                      Selecione a semente
                    </option>

                    {produtos.map((produto) => (
                      <option
                        key={produto.id_produto}
                        value={produto.id_produto}
                      >
                        {produto.nome_produto}
                      </option>
                    ))}
                  </select>
                </Campo>

                <Campo titulo="Área plantada (ha)" obrigatorio>
                  <input
                    name="areaPlantada"
                    type="number"
                    required
                    min="0.01"
                    max={loteSelecionado?.area}
                    step="0.01"
                    placeholder="Ex.: 2,50"
                    className="input"
                  />

                  {loteSelecionado && (
                    <p className="mt-1 text-xs text-slate-500">
                      Área total do lote:{" "}
                      {loteSelecionado.area.toFixed(2)} ha
                    </p>
                  )}
                </Campo>

                <Campo titulo="Quantidade de sementes" obrigatorio>
                  <input
                    name="quantidade"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="Ex.: 100"
                    className="input"
                  />

                  {produtoSelecionado && (
                    <p className="mt-1 text-xs text-slate-500">
                      Unidade cadastrada no estoque:{" "}
                      {produtoSelecionado.unidade_medida}
                    </p>
                  )}
                </Campo>

                <Campo titulo="Data do plantio" obrigatorio>
                  <input
                    name="dataPlantio"
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    className="input"
                  />
                </Campo>

                <Campo titulo="Previsão de colheita">
                  <input
                    name="previsaoColheita"
                    type="date"
                    className="input"
                  />

                  <p className="mt-1 text-xs text-slate-500">
                    Se ficar em branco, será calculada pelo ciclo
                    estimado da cultura.
                  </p>
                </Campo>
              </div>

              {lotes.length === 0 && (
                <p className="mt-6 rounded-xl bg-yellow-50 p-4 text-sm font-medium text-yellow-800">
                  Não existem lotes ativos cadastrados.
                </p>
              )}

              {produtos.length === 0 && (
                <p className="mt-6 rounded-xl bg-yellow-50 p-4 text-sm font-medium text-yellow-800">
                  Não existem sementes vinculadas a culturas ativas.
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

              <footer className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-6">
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
                    carregando ||
                    lotes.length === 0 ||
                    produtos.length === 0
                  }
                  className="rounded-xl bg-green-800 px-6 py-3 font-semibold text-white hover:bg-green-900 disabled:opacity-50"
                >
                  {carregando
                    ? "Cadastrando..."
                    : "Cadastrar plantio"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

type CampoProps = {
  titulo: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
};

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