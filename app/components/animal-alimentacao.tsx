"use client";

import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { quantidadeInteira, usaDose } from "@/app/lib/estoque-regras";

type Produto = {
  id: number;
  nome: string;
  saldo: string;
  unidade: string;
  incompatibilidade: string | null;
};

type Props = {
  idAnimal: number;
  ativo: boolean;
  aoSalvar: () => void;
  aoAlterarEnvio: (enviando: boolean) => void;
};

const estiloCampo = "input";

function numero(valor: string) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AnimalAlimentacao({
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

  const produto = produtos.find(
    (item) => item.id === Number(idProduto),
  );

  useEffect(() => {
    if (!aberto) return;

    const controlador = new AbortController();

    async function carregar() {
      setCarregando(true);
      setErro("");
      setProdutos([]);

      try {
        const resposta = await fetch(
          `/api/animais/alimentacoes?idAnimal=${idAnimal}`,
          {
            signal: controlador.signal,
            cache: "no-store",
          },
        );

        const dados = await resposta.json().catch(() => null);

        if (!resposta.ok) {
          throw new Error(
            dados?.error || "Não foi possível carregar os alimentos.",
          );
        }

        if (
          !Array.isArray(dados?.produtos) ||
          typeof dados.hoje !== "string"
        ) {
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
            : "Não foi possível carregar os alimentos.",
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

    if (produto.incompatibilidade) {
      setErro(produto.incompatibilidade);
      return;
    }
    if (usaDose(produto.unidade) && (!quantidadeInteira(quantidade) || Number(quantidade) <= 0)) {
      setErro("A quantidade em Dose deve ser um número inteiro positivo.");
      return;
    }

    const formulario = new FormData(event.currentTarget);

    enviandoRef.current = true;
    setSalvando(true);
    aoAlterarEnvio(true);
    setErro("");

    try {
      const resposta = await fetch("/api/animais/alimentacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idAnimal,
          idProduto: produto.id,
          unidade: produto.unidade,
          quantidade,
          data,
          observacao: formulario.get("observacao"),
        }),
      });

      const dados = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(
          dados?.error || "Não foi possível registrar a alimentação.",
        );
      }

      if (!dados?.idAlimentacao) {
        throw new Error(
          "Resposta inesperada. Confira o histórico antes de tentar novamente.",
        );
      }

      setAberto(false);
      setSucesso("Alimentação registrada e estoque atualizado.");
      aoSalvar();
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
      aoAlterarEnvio(false);
    }
  }

  if (!ativo) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Novas alimentações só podem ser registradas para animais ativos.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-[#244b49]">
            Alimentação
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Registre o alimento fornecido ao animal.
          </p>
        </div>

        {!aberto && (
          <button
            type="button"
            onClick={abrir}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#486d6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#244b49]"
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
            Registrar alimentação
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
              Consultando alimentos disponíveis...
            </p>
          )}

          <fieldset
            disabled={carregando || salvando}
            className="grid min-w-0 gap-4 sm:grid-cols-2"
          >
            <label className="block min-w-0 sm:col-span-2">
              <span className="mb-2 block text-sm font-medium">
                Alimento *
              </span>

              <select
                required
                value={idProduto}
                onChange={(event) => {
                  setIdProduto(event.target.value);
                  setQuantidade("");
                }}
                className={estiloCampo}
              >
                <option value="">Selecione o produto</option>

                {produtos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome} — {numero(item.saldo)} {item.unidade}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="mb-2 block text-sm font-medium">
                Data da alimentação *
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
                Quantidade {produto ? `(${produto.unidade})` : ""} *
              </span>

              <input
                type="number"
                required
                min={produto && usaDose(produto.unidade) ? "1" : "0.01"}
                max={produto?.saldo ?? "99999999.99"}
                step={produto && usaDose(produto.unidade) ? "1" : "0.01"}
                value={quantidade}
                onChange={(event) =>
                  setQuantidade(event.target.value)
                }
                placeholder={produto && usaDose(produto.unidade) ? "1" : "0,00"}
                className={estiloCampo}
              />
            </label>

            <label className="block min-w-0 sm:col-span-2">
              <span className="mb-2 block text-sm font-medium">
                Observação
              </span>

              <textarea
                name="observacao"
                rows={3}
                maxLength={255}
                placeholder="Detalhes sobre a alimentação"
                className={`${estiloCampo} resize-y`}
              />
            </label>
          </fieldset>

          {produto && (
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-medium text-[#244b49]">
                Estoque disponível: {numero(produto.saldo)}{" "}
                {produto.unidade}
              </p>

              <p className="mt-2 text-slate-500">
                A quantidade informada será descontada automaticamente.
                Não registre outra saída manual para esta alimentação.
              </p>
            </div>
          )}

          {!carregando && !erro && produtos.length === 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Não há produtos da categoria Alimentação com saldo
              disponível.
            </p>
          )}

          {produto?.incompatibilidade && (
            <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {produto.incompatibilidade}
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
                  Atualizar produtos disponíveis
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
              disabled={carregando || salvando || !produto || Boolean(produto.incompatibilidade)}
              className="rounded-xl bg-[#486d6b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#244b49] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {salvando ? "Registrando..." : "Confirmar alimentação"}
            </button>
          </footer>
        </form>
      )}
    </section>
  );
}
