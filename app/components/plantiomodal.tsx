"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UiIcon from "@/app/components/ui-icon";
import { dataEmSaoPaulo } from "@/app/lib/data-calendario";

type Lote = { id_lote: number; nome_lote: string; area: number };
type Produto = { id_produto: number; nome_produto: string; unidade_medida: string };
type PlantioModalProps = { lotes: Lote[]; produtos: Produto[] };

export default function PlantioModal({ lotes, produtos }: PlantioModalProps) {
  const router = useRouter();
  const tituloId = useId();
  const descricaoId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const loteRef = useRef<HTMLSelectElement>(null);
  const enviandoRef = useRef(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [idLote, setIdLote] = useState("");
  const [idProduto, setIdProduto] = useState("");
  const [hoje, setHoje] = useState("");
  const loteSelecionado = lotes.find((lote) => lote.id_lote === Number(idLote));
  const produtoSelecionado = produtos.find((produto) => produto.id_produto === Number(idProduto));

  function abrirModal() {
    setErro("");
    setIdLote("");
    setIdProduto("");
    setHoje(dataEmSaoPaulo(new Date()));
    setModalAberto(true);
  }

  function fecharModal() {
    if (enviandoRef.current) return;
    setErro("");
    setModalAberto(false);
  }

  useEffect(() => {
    if (!modalAberto) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const botao = botaoRef.current;
    const overflowAnterior = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    loteRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflowAnterior;
      if (botao?.isConnected) botao.focus();
    };
  }, [modalAberto]);

  async function cadastrarPlantio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviandoRef.current || lotes.length === 0 || produtos.length === 0) return;
    const formulario = event.currentTarget;
    const formData = new FormData(formulario);
    enviandoRef.current = true;
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch("/api/plantios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idLote: formData.get("lote"), idProduto: formData.get("produto"),
          dataPlantio: formData.get("dataPlantio"), previsaoColheita: formData.get("previsaoColheita"),
          quantidade: formData.get("quantidade"), areaPlantada: formData.get("areaPlantada"),
        }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(dados?.error || "Não foi possível cadastrar o plantio.");
      if (!Number.isSafeInteger(dados?.plantio?.id_plantio)) {
        throw new Error("Resposta inesperada. Confira os plantios antes de tentar novamente.");
      }
      formulario.reset();
      setModalAberto(false);
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível cadastrar o plantio.");
    } finally {
      enviandoRef.current = false;
      setCarregando(false);
    }
  }

  return (
    <>
      <button ref={botaoRef} type="button" onClick={abrirModal}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#486d6b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#244b49]">
        <UiIcon nome="adicionar" />
        Novo plantio
      </button>
      <dialog ref={dialogRef} aria-labelledby={tituloId} aria-describedby={descricaoId}
        onCancel={(event) => { event.preventDefault(); fecharModal(); }}
        onClose={() => { if (!enviandoRef.current) setModalAberto(false); }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[92vw] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-black/60">
        {modalAberto && <>
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:p-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#486d6b]">Agricultura</p>
              <h2 id={tituloId} className="mt-1 text-xl font-bold text-[#244b49] sm:text-2xl">Cadastrar plantio</h2>
              <p id={descricaoId} className="mt-1 text-sm text-slate-500">Registre a semente e a área utilizada no lote.</p>
            </div>
            <button type="button" aria-label="Fechar cadastro de plantio" onClick={fecharModal} disabled={carregando}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-60">
              <UiIcon nome="fechar" />
            </button>
          </header>
          <form onSubmit={cadastrarPlantio} aria-busy={carregando} className="p-5 sm:p-6">
            <fieldset disabled={carregando} className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
              <Campo titulo="Lote" obrigatorio>
                <select ref={loteRef} name="lote" required value={idLote}
                  onChange={(event) => setIdLote(event.target.value)} className="input">
                  <option value="" disabled>Selecione o lote</option>
                  {lotes.map((lote) => <option key={lote.id_lote} value={lote.id_lote}>{lote.nome_lote} — {lote.area.toFixed(2)} ha</option>)}
                </select>
              </Campo>
              <Campo titulo="Semente" obrigatorio>
                <select name="produto" required value={idProduto}
                  onChange={(event) => setIdProduto(event.target.value)} className="input">
                  <option value="" disabled>Selecione a semente</option>
                  {produtos.map((produto) => <option key={produto.id_produto} value={produto.id_produto}>{produto.nome_produto}</option>)}
                </select>
              </Campo>
              <Campo titulo="Área plantada (ha)" obrigatorio>
                <input name="areaPlantada" type="number" required min="0.01" max={loteSelecionado?.area} step="0.01" placeholder="Ex.: 2,50" className="input" />
                {loteSelecionado && <p className="mt-1 text-xs text-slate-500">Área total do lote: {loteSelecionado.area.toFixed(2)} ha. A área livre será validada ao salvar.</p>}
              </Campo>
              <Campo titulo="Quantidade de sementes" obrigatorio>
                <input name="quantidade" type="number" required min="0.01" step="0.01" placeholder="Ex.: 100" className="input" />
                {produtoSelecionado && <p className="mt-1 text-xs text-slate-500">Unidade cadastrada no estoque: {produtoSelecionado.unidade_medida}</p>}
              </Campo>
              <Campo titulo="Data do plantio" obrigatorio>
                <input name="dataPlantio" type="date" required max={hoje || undefined} className="input" />
              </Campo>
              <Campo titulo="Previsão de colheita">
                <input name="previsaoColheita" type="date" className="input" />
                <p className="mt-1 text-xs text-slate-500">Se ficar em branco, será calculada pelo ciclo estimado da cultura.</p>
              </Campo>
            </fieldset>
            {lotes.length === 0 && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Não existem lotes ativos cadastrados.</p>}
            {produtos.length === 0 && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Não existem sementes vinculadas a culturas ativas.</p>}
            {erro && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{erro}</p>}
            <footer className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={fecharModal} disabled={carregando} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Cancelar</button>
              <button type="submit" disabled={carregando || lotes.length === 0 || produtos.length === 0}
                className="rounded-xl bg-[#486d6b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#244b49] disabled:opacity-60">
                {carregando ? "Cadastrando..." : "Cadastrar plantio"}
              </button>
            </footer>
          </form>
        </>}
      </dialog>
    </>
  );
}

function Campo({ titulo, obrigatorio = false, children }: { titulo: string; obrigatorio?: boolean; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-semibold text-slate-700">{titulo}{obrigatorio && <span className="ml-1 text-red-500"> *</span>}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
