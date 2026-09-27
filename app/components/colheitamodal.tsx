"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

type Props = {
  idPlantio: number;
  nomeCultura: string;
  nomeLote: string;
};

type ProdutoDestino = {
  id_produto: number;
  nome_produto: string;
};

type DadosFormulario = {
  produtos: ProdutoDestino[];
  dataPlantio: string;
  hoje: string;
};

export default function ColheitaModal({
  idPlantio,
  nomeCultura,
  nomeLote,
}: Props) {
  const router = useRouter();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const enviandoRef = useRef(false);

  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<DadosFormulario | null>(null);

  function fechar() {
    if (enviandoRef.current) return;

    setAberto(false);
    setErro("");
  }

  useEffect(() => {
    if (!aberto) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      dialog.close();
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    const controller = new AbortController();

    async function carregar() {
      setCarregando(true);
      setDados(null);
      setErro("");

      try {
        const resposta = await fetch(
          `/api/colheitas?idPlantio=${idPlantio}`,
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
            "Não foi possível carregar os produtos da colheita.",
          );
        }

        const resultado = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            resultado.error || "Erro ao carregar os produtos.",
          );
        }

        if (!controller.signal.aborted) {
          setDados(resultado);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setErro(
            error instanceof Error
              ? error.message
              : "Erro ao carregar o formulário.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    carregar();

    return () => controller.abort();
  }, [aberto, idPlantio]);

  async function registrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (enviandoRef.current) return;

    const formulario = event.currentTarget;
    const formData = new FormData(formulario);

    enviandoRef.current = true;
    setSalvando(true);
    setErro("");

    try {
      const resposta = await fetch("/api/colheitas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idPlantio,
          idProdutoDestino: formData.get("produtoDestino"),
          data: formData.get("data"),
          quantidade: formData.get("quantidade"),
          unidade: formData.get("unidade"),
          observacao: formData.get("observacao"),
        }),
      });

      if (
        !resposta.headers
          .get("content-type")
          ?.includes("application/json")
      ) {
        throw new Error(
          "A API de colheitas não respondeu corretamente.",
        );
      }

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.error || "Não foi possível registrar a colheita.",
        );
      }

      formulario.reset();
      setAberto(false);
      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a colheita.",
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
        onClick={() => setAberto(true)}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-[#244b49] hover:bg-[#edf4f3]"
      >
        Registrar colheita
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`titulo-colheita-${idPlantio}`}
        onCancel={(event) => {
          event.preventDefault();
          fechar();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[92vw] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-black/60"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#486d6b]">
              Registrar colheita
            </p>

            <h2
              id={`titulo-colheita-${idPlantio}`}
              className="mt-1 break-words text-xl font-bold text-[#244b49]"
            >
              {nomeCultura}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {nomeLote} · Plantio #{idPlantio}
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar colheita"
            onClick={fechar}
            disabled={salvando}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <div className="p-5">
          {carregando && (
            <p role="status" className="text-sm text-slate-500">
              Carregando produtos…
            </p>
          )}

          {dados && dados.produtos.length === 0 && (
            <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              Não há um produto de destino em kg vinculado a essa
              cultura. Cadastre o produto colhido antes de continuar.
            </p>
          )}

          {dados && dados.produtos.length > 0 && (
            <form onSubmit={registrar}>
              <fieldset disabled={salvando} className="space-y-5">
                <label className="block">
                  <span className="text-sm font-semibold">
                    Produto que entrará no estoque *
                  </span>

                  <select
                    name="produtoDestino"
                    required
                    defaultValue={
                      dados.produtos.length === 1
                        ? String(dados.produtos[0].id_produto)
                        : ""
                    }
                    className="input mt-2"
                  >
                    <option value="" disabled>
                      Selecione o produto colhido
                    </option>

                    {dados.produtos.map((produto) => (
                      <option
                        key={produto.id_produto}
                        value={produto.id_produto}
                      >
                        {produto.nome_produto}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">
                    Data da colheita *
                  </span>

                  <input
                    name="data"
                    type="date"
                    required
                    defaultValue={dados.hoje}
                    min={dados.dataPlantio}
                    max={dados.hoje}
                    className="input mt-2"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold">
                      Quantidade *
                    </span>

                    <input
                      name="quantidade"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0,00"
                      className="input mt-2"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold">
                      Unidade *
                    </span>

                    <select
                      name="unidade"
                      defaultValue="KG"
                      className="input mt-2"
                    >
                      <option value="KG">Quilograma (kg)</option>
                      <option value="TONELADA">Tonelada (t)</option>
                    </select>
                  </label>
                </div>

                <p className="rounded-lg bg-[#edf4f3] p-3 text-xs text-[#244b49]">
                  O estoque será atualizado em kg.
                  Uma tonelada corresponde a 1.000 kg.
                </p>

                <label className="block">
                  <span className="text-sm font-semibold">
                    Observação
                  </span>

                  <textarea
                    name="observacao"
                    rows={3}
                    maxLength={255}
                    placeholder="Qualidade, destino ou outras observações"
                    className="input mt-2 resize-none"
                  />
                </label>
              </fieldset>

              <footer className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={fechar}
                  disabled={salvando}
                  className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-lg bg-[#486d6b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#244b49] disabled:opacity-50"
                >
                  {salvando ? "Registrando…" : "Registrar colheita"}
                </button>
              </footer>
            </form>
          )}

          {erro && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700"
            >
              {erro}
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}