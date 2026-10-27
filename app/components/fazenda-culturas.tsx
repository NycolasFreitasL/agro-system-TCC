"use client";

import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Cultura = {
  id: number;
  nome: string;
  diasGerminacaoMin: number;
  diasGerminacaoMax: number;
  cicloDiasMin: number;
  cicloDiasMax: number;
  produtividadeMin: string;
  produtividadeMax: string;
  ativo: boolean;
  produtos: number;
  plantios: number;
};

type ValoresFormulario = {
  nome: string;
  diasGerminacaoMin: string;
  diasGerminacaoMax: string;
  cicloDiasMin: string;
  cicloDiasMax: string;
  produtividadeMin: string;
  produtividadeMax: string;
  ativo: boolean;
};

const estiloCampo = "input mt-2";
const valoresVazios: ValoresFormulario = {
  nome: "",
  diasGerminacaoMin: "",
  diasGerminacaoMax: "",
  cicloDiasMin: "",
  cicloDiasMax: "",
  produtividadeMin: "",
  produtividadeMax: "",
  ativo: true,
};

function valoresDe(cultura: Cultura): ValoresFormulario {
  return {
    nome: cultura.nome,
    diasGerminacaoMin: String(cultura.diasGerminacaoMin),
    diasGerminacaoMax: String(cultura.diasGerminacaoMax),
    cicloDiasMin: String(cultura.cicloDiasMin),
    cicloDiasMax: String(cultura.cicloDiasMax),
    produtividadeMin: cultura.produtividadeMin,
    produtividadeMax: cultura.produtividadeMax,
    ativo: cultura.ativo,
  };
}

export default function FazendaCulturas({ culturas }: { culturas: Cultura[] }) {
  const router = useRouter();
  const enviandoRef = useRef(false);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [valores, setValores] = useState(valoresVazios);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  function abrirFormulario(cultura?: Cultura) {
    setErro("");
    setSucesso("");
    setEditandoId(cultura?.id ?? null);
    setValores(cultura ? valoresDe(cultura) : { ...valoresVazios });
    setFormularioAberto(true);
  }

  function cancelar() {
    if (enviandoRef.current) return;
    setFormularioAberto(false);
    setErro("");
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviandoRef.current) return;

    enviandoRef.current = true;
    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const resposta = await fetch("/api/fazenda/culturas", {
        method: editandoId === null ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editandoId,
          nome: valores.nome,
          dias_germinacao_min: valores.diasGerminacaoMin,
          dias_germinacao_max: valores.diasGerminacaoMax,
          ciclo_dias_min: valores.cicloDiasMin,
          ciclo_dias_max: valores.cicloDiasMax,
          produtividade_min_kg_ha: valores.produtividadeMin,
          produtividade_max_kg_ha: valores.produtividadeMax,
          ativo: valores.ativo,
        }),
      });
      const resultado = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(
          resultado?.error || "Não foi possível salvar a cultura.",
        );
      }

      setFormularioAberto(false);
      setSucesso(resultado?.message || "Cultura salva com sucesso.");
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

  function alterar(campo: keyof ValoresFormulario, valor: string | boolean) {
    setValores((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-bold text-[#244b49]">Culturas agrícolas</h2>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre as culturas usadas em sementes, plantios e colheitas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => abrirFormulario()}
          disabled={salvando || formularioAberto}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#486d6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#244b49] disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova cultura
        </button>
      </header>

      <div className="space-y-5 p-5 sm:p-6">
        {formularioAberto && (
          <form onSubmit={salvar} aria-busy={salvando} className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <h3 className="font-semibold text-[#244b49]">
              {editandoId === null ? "Cadastrar cultura" : "Editar cultura"}
            </h3>

            <fieldset disabled={salvando} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="block min-w-0 text-sm font-medium text-slate-700 sm:col-span-2">
                Nome da cultura *
                <input
                  required
                  maxLength={100}
                  value={valores.nome}
                  onChange={(event) => alterar("nome", event.target.value)}
                  placeholder="Ex.: Soja"
                  className={estiloCampo}
                />
              </label>

              <CampoNumero label="Germinação mínima (dias) *" value={valores.diasGerminacaoMin} onChange={(v) => alterar("diasGerminacaoMin", v)} max="2147483647" />
              <CampoNumero label="Germinação máxima (dias) *" value={valores.diasGerminacaoMax} onChange={(v) => alterar("diasGerminacaoMax", v)} max="2147483647" />
              <CampoNumero label="Ciclo mínimo (dias) *" value={valores.cicloDiasMin} onChange={(v) => alterar("cicloDiasMin", v)} max="2147483647" />
              <CampoNumero label="Ciclo máximo (dias) *" value={valores.cicloDiasMax} onChange={(v) => alterar("cicloDiasMax", v)} max="2147483647" />
              <CampoNumero label="Produtividade mínima (kg/ha) *" value={valores.produtividadeMin} onChange={(v) => alterar("produtividadeMin", v)} min="0" step="0.01" max="99999999.99" />
              <CampoNumero label="Produtividade máxima (kg/ha) *" value={valores.produtividadeMax} onChange={(v) => alterar("produtividadeMax", v)} min="0" step="0.01" max="99999999.99" />

              {editandoId !== null && (
                <label className="block min-w-0 text-sm font-medium text-slate-700">
                  Estado da cultura
                  <select
                    value={valores.ativo ? "ATIVO" : "INATIVO"}
                    onChange={(event) => alterar("ativo", event.target.value === "ATIVO")}
                    className={estiloCampo}
                  >
                    <option value="ATIVO">Ativa</option>
                    <option value="INATIVO">Inativa</option>
                  </select>
                </label>
              )}
            </fieldset>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Desativar remove a cultura das opções de novos cadastros. Produtos e plantios existentes continuam vinculados.
            </p>
            {editandoId !== null && (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Renomear também muda o nome exibido nos registros vinculados.
              </p>
            )}

            <footer className="mt-4 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={cancelar} disabled={salvando} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={salvando} className="min-h-11 rounded-lg bg-[#486d6b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#244b49] disabled:opacity-50">
                {salvando ? "Salvando..." : "Salvar cultura"}
              </button>
            </footer>
          </form>
        )}

        {erro && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{erro}</p>}
        {sucesso && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{sucesso}</p>}

        {culturas.length === 0 ? (
          <p className="estado-vazio">Nenhuma cultura cadastrada.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {culturas.map((cultura) => (
              <li key={cultura.id} className="flex min-w-0 flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words font-semibold text-slate-800">{cultura.nome}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cultura.ativo ? "bg-[#486d6b]/10 text-[#244b49]" : "bg-slate-100 text-slate-600"}`}>
                      {cultura.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Germinação: {cultura.diasGerminacaoMin}–{cultura.diasGerminacaoMax} dias · Ciclo: {cultura.cicloDiasMin}–{cultura.cicloDiasMax} dias
                  </p>
                  <p className="text-xs leading-5 text-slate-500">
                    Produtividade: {formatarNumero(cultura.produtividadeMin)}–{formatarNumero(cultura.produtividadeMax)} kg/ha · {cultura.produtos} produto(s) · {cultura.plantios} plantio(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => abrirFormulario(cultura)}
                  disabled={salvando || formularioAberto}
                  className="min-h-11 shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-[#486d6b] hover:bg-slate-50 disabled:opacity-50"
                >
                  Editar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CampoNumero({
  label,
  value,
  onChange,
  min = "1",
  max,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max: string;
  step?: string;
}) {
  return (
    <label className="block min-w-0 text-sm font-medium text-slate-700">
      {label}
      <input
        required
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={estiloCampo}
      />
    </label>
  );
}

function formatarNumero(valor: string) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
