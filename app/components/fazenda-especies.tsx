"use client";

import {
  type FormEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Especie = {
  id: number;
  nome: string;
  status: string;
  animais: number;
};

const estiloCampo = "input mt-2";

export default function FazendaEspecies({
  especies,
}: {
  especies: Especie[];
}) {
  const router = useRouter();
  const enviandoRef = useRef(false);

  const [formularioAberto, setFormularioAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [status, setStatus] = useState("ATIVO");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  function abrirFormulario(especie?: Especie) {
    setErro("");
    setSucesso("");
    setEditandoId(especie?.id ?? null);
    setNome(especie?.nome ?? "");
    setStatus(especie?.status ?? "ATIVO");
    setFormularioAberto(true);
  }

  function cancelar() {
    if (enviandoRef.current) return;

    setFormularioAberto(false);
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
      const resposta = await fetch("/api/fazenda/especies", {
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

      setFormularioAberto(false);
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
        status,
      },
    );
  }

  async function excluir(especie: Especie) {
    if (enviandoRef.current) return;

    const confirmou = window.confirm(
      `Excluir a espécie "${especie.nome}"? Essa ação não pode ser desfeita.`,
    );

    if (!confirmou) return;

    await enviar("DELETE", { id: especie.id });
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-bold text-[#244b49]">
            Espécies de animais
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Espécies disponíveis no cadastro de animais.
          </p>
        </div>

        <button
          type="button"
          onClick={() => abrirFormulario()}
          disabled={salvando || formularioAberto}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#486d6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#244b49] disabled:opacity-50"
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
          Nova espécie
        </button>
      </header>

      <div className="space-y-5 p-5 sm:p-6">
        {formularioAberto && (
          <form
            onSubmit={salvar}
            aria-busy={salvando}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <h3 className="font-semibold text-[#244b49]">
              {editandoId === null
                ? "Cadastrar espécie"
                : "Editar espécie"}
            </h3>

            <fieldset
              disabled={salvando}
              className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2"
            >
              <label className="block text-sm font-medium text-slate-700">
                Nome da espécie *
                <input
                  required
                  maxLength={60}
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Ex.: Bovino"
                  className={estiloCampo}
                />
              </label>

              {editandoId !== null && (
                <label className="block text-sm font-medium text-slate-700">
                  Status
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value)
                    }
                    className={estiloCampo}
                  >
                    <option value="ATIVO">Ativa</option>
                    <option value="INATIVO">Inativa</option>
                  </select>
                </label>
              )}
            </fieldset>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Desativar remove a espécie das opções de novos cadastros.
              Os animais existentes permanecem registrados.
            </p>

            {editandoId !== null && (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Renomear altera o nome exibido para todos os animais
                vinculados. Para uma espécie diferente, crie um novo cadastro.
              </p>
            )}

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
                className="rounded-lg bg-[#486d6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#244b49] disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar espécie"}
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

        {especies.length === 0 ? (
          <p className="estado-vazio">
            Nenhuma espécie cadastrada.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {especies.map((especie) => (
              <li
                key={especie.id}
                className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words font-semibold text-slate-800">
                      {especie.nome}
                    </p>

                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-xs font-medium " +
                        (especie.status === "ATIVO"
                          ? "bg-[#486d6b]/10 text-[#244b49]"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {especie.status === "ATIVO"
                        ? "Ativa"
                        : especie.status === "INATIVO"
                          ? "Inativa"
                          : especie.status}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    {especie.animais} animais vinculados
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => abrirFormulario(especie)}
                    disabled={salvando || formularioAberto}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-[#486d6b] hover:bg-slate-50 disabled:opacity-50"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => excluir(especie)}
                    disabled={
                      salvando ||
                      formularioAberto ||
                      especie.animais > 0
                    }
                    title={
                      especie.animais > 0
                        ? "Espécies com animais não podem ser excluídas."
                        : "Excluir espécie"
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
