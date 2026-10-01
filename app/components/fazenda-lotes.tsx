"use client";

import {
  type FormEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Lote = {
  id: number;
  nome: string;
  area: string;
  status: string;
  totalPlantios: number;
  plantiosAtivos: number;
  areaOcupada: number | null;
};

const estiloCampo =
  "mt-2 w-full min-w-0 rounded-xl border border-slate-300 " +
  "bg-white px-3 py-2.5 text-sm outline-none " +
  "focus:border-[#486d6b] focus:ring-2 focus:ring-[#486d6b]/15";

function hectares(valor: number) {
  return `${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`;
}

export default function FazendaLotes({
  lotes,
}: {
  lotes: Lote[];
}) {
  const router = useRouter();
  const enviandoRef = useRef(false);

  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("ATIVO");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  function abrirFormulario(lote?: Lote) {
    setErro("");
    setSucesso("");
    setEditandoId(lote?.id ?? null);
    setNome(lote?.nome ?? "");
    setArea(lote?.area ?? "");
    setStatus(lote?.status ?? "ATIVO");
    setAberto(true);
  }

  function cancelar() {
    if (enviandoRef.current) return;

    setAberto(false);
    setErro("");
  }

  async function enviar(
    metodo: "POST" | "PATCH" | "DELETE",
    dados: Record<string, unknown>,
  ) {
    if (enviandoRef.current) return;

    enviandoRef.current = true;
    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const resposta = await fetch("/api/fazenda/lotes", {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      });

      const resultado = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(
          resultado?.error ||
            "Não foi possível concluir a operação.",
        );
      }

      setAberto(false);
      setSucesso(
        resultado?.message || "Operação concluída com sucesso.",
      );
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

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await enviar(
      editandoId === null ? "POST" : "PATCH",
      {
        id: editandoId,
        nome,
        area,
        status,
      },
    );
  }

  async function excluir(lote: Lote) {
    if (enviandoRef.current) return;

    if (
      !window.confirm(
        `Excluir o lote "${lote.nome}"? Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    await enviar("DELETE", { id: lote.id });
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-bold text-[#123e40]">
            Lotes agrícolas
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Organize as áreas disponíveis para cultivo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => abrirFormulario()}
          disabled={salvando || aberto}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#486d6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#365452] disabled:opacity-50"
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
          Novo lote
        </button>
      </header>

      <div className="space-y-5 p-5 sm:p-6">
        {aberto && (
          <form
            onSubmit={salvar}
            aria-busy={salvando}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <h3 className="font-semibold text-[#123e40]">
              {editandoId === null ? "Cadastrar lote" : "Editar lote"}
            </h3>

            <fieldset
              disabled={salvando}
              className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2"
            >
              <label className="block min-w-0 text-sm font-medium text-slate-700">
                Nome do lote *
                <input
                  required
                  maxLength={50}
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Ex.: Lote Norte"
                  className={estiloCampo}
                />
              </label>

              <label className="block min-w-0 text-sm font-medium text-slate-700">
                Área total em hectares *
                <input
                  type="number"
                  required
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  placeholder="Ex.: 12,50"
                  className={estiloCampo}
                />
              </label>

              {editandoId !== null && (
                <label className="block min-w-0 text-sm font-medium text-slate-700">
                  Status
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={estiloCampo}
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </label>
              )}
            </fieldset>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              A área não pode ficar menor que a ocupação dos plantios
              ativos. Para desativar o lote, conclua esses plantios.
            </p>

            <footer className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelar}
                disabled={salvando}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-[#486d6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#365452] disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar lote"}
              </button>
            </footer>
          </form>
        )}

        {erro && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {erro}
          </p>
        )}

        {sucesso && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {sucesso}
          </p>
        )}

        {lotes.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Nenhum lote cadastrado.
          </p>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {lotes.map((lote) => (
              <li
                key={lote.id}
                className="min-w-0 rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="break-words font-semibold text-slate-800">
                    {lote.nome}
                  </h3>

                  <span
                    className={
                      "rounded-full px-2.5 py-1 text-xs font-medium " +
                      (lote.status === "ATIVO"
                        ? "bg-[#486d6b]/10 text-[#365452]"
                        : "bg-slate-100 text-slate-500")
                    }
                  >
                    {lote.status === "ATIVO"
                      ? "Ativo"
                      : lote.status === "INATIVO"
                        ? "Inativo"
                        : lote.status}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">
                      Área total
                    </dt>
                    <dd className="mt-1 font-semibold text-[#123e40]">
                      {hectares(Number(lote.area))}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">
                      Área ocupada
                    </dt>
                    <dd className="mt-1 font-semibold text-[#123e40]">
                      {lote.areaOcupada === null
                        ? "Não calculada"
                        : hectares(lote.areaOcupada)}
                    </dd>
                  </div>
                </dl>

                {lote.areaOcupada === null && (
                  <p className="mt-3 text-xs text-amber-700">
                    Existe plantio ativo sem área informada.
                  </p>
                )}

                <p className="mt-3 text-xs text-slate-500">
                  {lote.plantiosAtivos} plantios ativos ·{" "}
                  {lote.totalPlantios} registros de plantio
                </p>

                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => abrirFormulario(lote)}
                    disabled={salvando || aberto}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-[#486d6b] hover:bg-slate-50 disabled:opacity-50"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => excluir(lote)}
                    disabled={
                      salvando ||
                      aberto ||
                      lote.totalPlantios > 0
                    }
                    title={
                      lote.totalPlantios > 0
                        ? "Lotes com histórico não podem ser excluídos."
                        : "Excluir lote"
                    }
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}