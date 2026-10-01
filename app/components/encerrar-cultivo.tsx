"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motivoValido, type TipoEncerramento } from "@/app/lib/encerramento-cultivo";

type Props = {
  idPlantio: number;
  nomeCultura: string;
  possuiColheita: boolean;
  areaPlantada: string | null;
};

export default function EncerrarCultivo({ idPlantio, nomeCultura, possuiColheita, areaPlantada }: Props) {
  const router = useRouter();
  const tituloId = useId();
  const descricaoId = useId();
  const motivoId = useId();
  const ajudaMotivoId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);
  const enviandoRef = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [tipo, setTipo] = useState<TipoEncerramento>("NORMAL");
  const [motivo, setMotivo] = useState("");

  function abrir(novoTipo: TipoEncerramento) {
    setTipo(novoTipo);
    setMotivo("");
    setErro("");
    setSucesso("");
    setAberto(true);
  }

  function fechar() {
    if (enviandoRef.current) return;
    setAberto(false);
    setErro("");
  }

  useEffect(() => {
    if (!aberto) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    motivoRef.current?.focus();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto]);

  async function encerrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviandoRef.current) return;
    if (!motivoValido(motivo)) {
      setErro("Informe um motivo com 5 a 1000 caracteres.");
      motivoRef.current?.focus();
      return;
    }
    enviandoRef.current = true;
    setSalvando(true);
    setErro("");
    try {
      const resposta = await fetch("/api/plantios/encerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idPlantio, tipoEncerramento: tipo, motivo: motivo.trim() }),
      }).catch(() => {
        throw new Error("Não foi possível receber a resposta do servidor. Confira o histórico antes de tentar novamente.");
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        throw new Error(dados?.error || "Não foi possível encerrar o cultivo.");
      }
      if (!Number.isSafeInteger(dados?.idEvento) || typeof dados?.message !== "string") {
        throw new Error("Resposta inesperada. Confira o histórico antes de tentar novamente.");
      }
      setAberto(false);
      setSucesso(dados.message);
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível encerrar o cultivo.");
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" disabled={!possuiColheita} onClick={() => abrir("NORMAL")}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#486d6b] px-3 py-2 text-sm font-semibold text-[#244b49] hover:bg-[#edf4f3] disabled:cursor-not-allowed disabled:opacity-50">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
            <path d="m5 12 4 4L19 6" />
          </svg>
          Encerrar normalmente
        </button>
        <button type="button" onClick={() => abrir("PERDA")}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#486d6b] px-3 py-2 text-sm font-semibold text-[#244b49] hover:bg-[#edf4f3]">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
            <path d="m12 3 10 18H2L12 3Z M12 9v5 M12 17h.01" />
          </svg>
          Encerrar por perda
        </button>
      </div>
      {!possuiColheita && <p className="mt-2 text-xs text-slate-500">O encerramento normal exige uma colheita. Em caso de perda, informe o motivo para liberar a área.</p>}
      {sucesso && <p role="status" className="mt-3 rounded-lg bg-[#edf4f3] p-3 text-sm text-[#244b49]">{sucesso}</p>}

      <dialog ref={dialogRef} aria-labelledby={tituloId} aria-describedby={descricaoId}
        onCancel={(event) => { event.preventDefault(); fechar(); }}
        onClose={() => { if (!enviandoRef.current) setAberto(false); }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[92vw] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-black/60">
        {aberto && <>
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
            <div className="min-w-0">
              <h2 id={tituloId} className="text-xl font-bold text-[#244b49]">{tipo === "NORMAL" ? "Encerrar cultivo normalmente" : "Encerrar cultivo por perda"}</h2>
              <p className="mt-1 break-words text-sm text-slate-500">{nomeCultura} · Plantio #{idPlantio}</p>
            </div>
            <button type="button" aria-label="Fechar encerramento" onClick={fechar} disabled={salvando}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#486d6b] hover:bg-slate-100 disabled:opacity-50">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </header>
          <form onSubmit={encerrar} aria-busy={salvando} className="space-y-4 p-5">
            <p id={descricaoId} className="text-sm leading-6 text-slate-600">
              {tipo === "NORMAL" ? "Confirme que a última colheita foi registrada."
                : possuiColheita ? "Já existem colheitas neste cultivo. A perda será registrada para o restante."
                : "Não há colheitas neste cultivo. A perda será registrada como total."}
              {" "}O sistema confere as colheitas ao confirmar o encerramento.
            </p>
            <div className="rounded-xl bg-[#edf4f3] p-4 text-sm leading-6 text-[#244b49]">
              <p>Área a liberar: {areaPlantada === null ? "Não informada" : `${areaPlantada} ha`}.</p>
              <p>Colheitas e movimentações já registradas serão preservadas. Sementes utilizadas não retornam ao estoque. Novas colheitas serão bloqueadas.</p>
            </div>
            <label htmlFor={motivoId} className="block text-sm font-semibold text-[#244b49]">Motivo do encerramento *</label>
            <textarea id={motivoId} ref={motivoRef} required disabled={salvando} rows={4}
              value={motivo} onChange={(event) => setMotivo(event.target.value)} aria-describedby={ajudaMotivoId}
              className="w-full min-w-0 resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-[#486d6b] focus:ring-2 focus:ring-[#486d6b]/15 disabled:bg-slate-100" />
            <p id={ajudaMotivoId} className="text-xs text-slate-500">Descreva o motivo em 5 a 1000 caracteres. Ele será preservado junto ao responsável e à data.</p>
            {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
            <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={fechar} disabled={salvando} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50">Manter ativo</button>
              <button type="submit" disabled={salvando || !motivoValido(motivo)} className="rounded-lg bg-[#486d6b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#244b49] disabled:cursor-not-allowed disabled:opacity-50">{salvando ? "Encerrando…" : "Confirmar encerramento"}</button>
            </footer>
          </form>
        </>}
      </dialog>
    </div>
  );
}
