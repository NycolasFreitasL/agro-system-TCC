"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Produto = {
  id: number;
  nome: string;
  saldo: string;
};

type Props = {
  idAnimal: number;
  ativo: boolean;
  aoSalvar: () => void;
  aoAlterarEnvio: (enviando: boolean) => void;
};

const estiloCampo =
  "w-full min-w-0 rounded-xl border border-slate-300 bg-white " +
  "px-3 py-2.5 text-sm outline-none focus:border-[#486d6b] " +
  "focus:ring-2 focus:ring-[#486d6b]/15 disabled:bg-slate-100";

function numero(valor: string) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AnimalVacinacao({
  idAnimal,
  ativo,
  aoSalvar,
  aoAlterarEnvio,
}: Props) {
  const router = useRouter();
  const enviandoRef = useRef(false);

  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [tentativa, setTentativa] = useState(0);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [idProduto, setIdProduto] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [data, setData] = useState("");
  const [hoje, setHoje] = useState("");
  const [nascimento, setNascimento] = useState<string | null>(null);

  const produto = produtos.find((item) => item.id === Number(idProduto));

  useEffect(() => {
    if (!aberto) return;

    const controlador = new AbortController();

    async function carregar() {
      setCarregando(true);
      setErro("");
      setProdutos([]);

      try {
        const resposta = await fetch(
          `/api/animais/vacinacoes?idAnimal=${idAnimal}`,
          {
            signal: controlador.signal,
            cache: "no-store",
          },
        );

        const dados = await resposta.json().catch(() => null);

        if (!resposta.ok) {
          throw new Error(
            dados?.error || "Não foi possível carregar as vacinas.",
          );
        }

        if (!Array.isArray(dados?.produtos) || typeof dados.hoje !== "string") {
          throw new Error("O servidor retornou dados inválidos.");
        }

        if (controlador.signal.aborted) return;

        setProdutos(dados.produtos);
        setHoje(dados.hoje);
        setData(dados.hoje);
        setNascimento(dados.nascimento);
      } catch (error) {
        if (controlador.signal.aborted) return;

        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as vacinas.",
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    carregar();

    return () => controlador.abort();
  }, [aberto, idAnimal, tentativa]);

  function abrir() {
    setSucesso("");
    setErro("");
    setIdProduto("");
    setQuantidade("");
    setAberto(true);
  }

  function cancelar() {
    if (enviandoRef.current) return;

    setAberto(false);
    setErro("");
  }

  async function registrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (enviandoRef.current || !produto) return;

    const formulario = new FormData(event.currentTarget);

    enviandoRef.current = true;
    setSalvando(true);
    aoAlterarEnvio(true);
    setErro("");

    try {
      const resposta = await fetch("/api/animais/vacinacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idAnimal,
          idProduto: produto.id,
          quantidade,
          data,
          observacao: formulario.get("observacao"),
        }),
      });

      const dados = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(
          dados?.error || "Não foi possível registrar a vacinação.",
        );
      }

      if (!dados?.idVacinacao) {
        throw new Error(
          "Resposta inesperada. Confira o histórico antes de tentar novamente.",
        );
      }

      setAberto(false);
      setSucesso("Vacinação registrada e estoque atualizado.");
      aoSalvar();
      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
      );
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
      aoAlterarEnvio(false);
    }
  }

  if (!ativo) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Novas vacinações só podem ser registradas para animais ativos.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-[#123e40]">Vacinação</h3>

          <p className="mt-1 text-sm text-slate-500">
            Registre a aplicação realizada no animal.
          </p>
        </div>

        {!aberto && (
          <button
            type="button"
            onClick={abrir}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#486d6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#365452]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Registrar vacinação
          </button>
        )}
      </div>

      {sucesso && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {sucesso}
        </p>
      )}

      {aberto && (
        <form
          onSubmit={registrar}
          className="mt-5 space-y-4"
          aria-busy={carregando || salvando}
        >
          {carregando && (
            <p role="status" className="text-sm text-slate-500">
              Consultando vacinas disponíveis...
            </p>
          )}

          <fieldset
            disabled={carregando || salvando}
            className="grid min-w-0 gap-4 sm:grid-cols-2"
          >
            <label className="block min-w-0 sm:col-span-2">
              <span className="mb-2 block text-sm font-medium">Vacina *</span>

              <select
                required
                value={idProduto}
                onChange={(event) => {
                  setIdProduto(event.target.value);
                  setQuantidade("");
                }}
                className={estiloCampo}
              >
                <option value="">Selecione a vacina</option>

                {produtos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome} — {numero(item.saldo)} doses
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="mb-2 block text-sm font-medium">
                Data da aplicação *
              </span>

              <input
                type="date"
                required
                value={data}
                min={nascimento || undefined}
                max={hoje || undefined}
                onChange={(event) => setData(event.target.value)}
                className={estiloCampo}
              />
            </label>

            <label className="block min-w-0">
              <span className="mb-2 block text-sm font-medium">
                Quantidade aplicada em doses *
              </span>

              <input
                type="number"
                required
                min="1"
                max={
                  produto
                    ? Math.min(Math.floor(Number(produto.saldo)), 999)
                    : 999
                }
                step="1"
                value={quantidade}
                onChange={(event) => setQuantidade(event.target.value)}
                placeholder="Informe a quantidade"
                className={estiloCampo}
              />
            </label>

            <label className="block min-w-0 sm:col-span-2">
              <span className="mb-2 block text-sm font-medium">Observação</span>

              <textarea
                name="observacao"
                rows={3}
                maxLength={255}
                placeholder="Detalhes sobre a aplicação"
                className={`${estiloCampo} resize-y`}
              />
            </label>
          </fieldset>

          {produto && (
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-medium text-[#123e40]">
                Estoque disponível: {numero(produto.saldo)} doses
              </p>

              <p className="mt-2 text-slate-500">
                A quantidade registrada será descontada automaticamente do
                estoque, em doses.
              </p>
            </div>
          )}

          {!carregando && !erro && produtos.length === 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Não há vacinas com saldo disponível cadastradas na unidade Dose.
            </p>
          )}

          {erro && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              <p>{erro}</p>

              {!salvando && (
                <button
                  type="button"
                  onClick={() => {
                    setIdProduto("");
                    setQuantidade("");
                    setTentativa((valor) => valor + 1);
                  }}
                  className="mt-2 font-semibold underline"
                >
                  Atualizar vacinas disponíveis
                </button>
              )}
            </div>
          )}

          <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancelar}
              disabled={salvando}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={carregando || salvando || !produto}
              className="rounded-xl bg-[#486d6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#365452] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? "Registrando..." : "Confirmar vacinação"}
            </button>
          </footer>
        </form>
      )}
    </section>
  );
}
