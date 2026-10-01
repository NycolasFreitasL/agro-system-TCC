"use client";

import {
  type FormEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type DadosFazenda = {
  nome: string;
  municipio: string | null;
  uf: string | null;
  endereco: string | null;
  telefone: string | null;
};

type Props = {
  fazenda: DadosFazenda | null;
};

const ESTADOS = [
  ["AC", "Acre"],
  ["AL", "Alagoas"],
  ["AP", "Amapá"],
  ["AM", "Amazonas"],
  ["BA", "Bahia"],
  ["CE", "Ceará"],
  ["DF", "Distrito Federal"],
  ["ES", "Espírito Santo"],
  ["GO", "Goiás"],
  ["MA", "Maranhão"],
  ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"],
  ["PA", "Pará"],
  ["PB", "Paraíba"],
  ["PR", "Paraná"],
  ["PE", "Pernambuco"],
  ["PI", "Piauí"],
  ["RJ", "Rio de Janeiro"],
  ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"],
  ["RR", "Roraima"],
  ["SC", "Santa Catarina"],
  ["SP", "São Paulo"],
  ["SE", "Sergipe"],
  ["TO", "Tocantins"],
];

const estiloCampo = "input mt-2";

export default function FazendaFormulario({
  fazenda,
}: Props) {
  const router = useRouter();
  const enviandoRef = useRef(false);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  function limparMensagens() {
    setErro("");
    setSucesso("");
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (enviandoRef.current) return;

    const formulario = event.currentTarget;
    const dados = new FormData(formulario);

    enviandoRef.current = true;
    setSalvando(true);
    limparMensagens();

    try {
      const resposta = await fetch("/api/fazenda", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: dados.get("nome"),
          municipio: dados.get("municipio"),
          uf: dados.get("uf"),
          endereco: dados.get("endereco"),
          telefone: dados.get("telefone"),
        }),
      });

      const resultado = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(
          resultado?.error ||
            "Não foi possível salvar os dados da fazenda.",
        );
      }

      if (!resultado?.fazenda) {
        throw new Error(
          "Resposta inesperada. Atualize a página para conferir os dados salvos.",
        );
      }

      setSucesso("Dados da fazenda salvos com sucesso.");
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

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 p-5 sm:p-6">
        <h2 className="font-bold text-[#244b49]">
          Dados da propriedade
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Mantenha as informações de identificação e contato atualizadas.
        </p>
      </header>

      <form
        onSubmit={salvar}
        onChange={limparMensagens}
        aria-busy={salvando}
        className="p-5 sm:p-6"
      >
        <fieldset
          disabled={salvando}
          className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2"
        >
          <label className="block min-w-0 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Nome da fazenda
              <span className="ml-1 text-red-500">*</span>
            </span>

            <input
              name="nome"
              required
              maxLength={100}
              defaultValue={fazenda?.nome ?? ""}
              placeholder="Ex.: Fazenda Boa Esperança"
              className={estiloCampo}
            />
          </label>

          <label className="block min-w-0">
            <span className="text-sm font-medium text-slate-700">
              Município
            </span>

            <input
              name="municipio"
              maxLength={100}
              defaultValue={fazenda?.municipio ?? ""}
              autoComplete="address-level2"
              placeholder="Ex.: Boa Esperança do Sul"
              className={estiloCampo}
            />
          </label>

          <label className="block min-w-0">
            <span className="text-sm font-medium text-slate-700">
              Estado
            </span>

            <select
              name="uf"
              defaultValue={fazenda?.uf ?? ""}
              autoComplete="address-level1"
              className={estiloCampo}
            >
              <option value="">Não informado</option>

              {ESTADOS.map(([sigla, nome]) => (
                <option key={sigla} value={sigla}>
                  {nome} — {sigla}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              Endereço ou localização
            </span>

            <input
              name="endereco"
              maxLength={200}
              defaultValue={fazenda?.endereco ?? ""}
              autoComplete="street-address"
              placeholder="Estrada, bairro rural ou referência de acesso"
              className={estiloCampo}
            />
          </label>

          <label className="block min-w-0">
            <span className="text-sm font-medium text-slate-700">
              Telefone de contato
            </span>

            <input
              name="telefone"
              type="tel"
              maxLength={20}
              defaultValue={fazenda?.telefone ?? ""}
              autoComplete="tel"
              placeholder="(16) 99999-9999"
              className={estiloCampo}
            />
          </label>
        </fieldset>

        {erro && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {erro}
          </p>
        )}

        {sucesso && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {sucesso}
          </p>
        )}

        <footer className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Apenas o nome da fazenda é obrigatório.
          </p>

          <button
            type="submit"
            disabled={salvando}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#486d6b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#244b49] disabled:cursor-wait disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
              <path d="M7 3v6h9V3M7 21v-8h10v8" />
            </svg>

            {salvando ? "Salvando..." : "Salvar dados"}
          </button>
        </footer>
      </form>
    </section>
  );
}
