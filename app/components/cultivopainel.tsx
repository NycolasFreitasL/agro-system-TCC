"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

type PainelProps = {
  plantios: ReactNode;
  lotes: ReactNode;
  historico: ReactNode;
};

export default function CultivoPainel({
  plantios,
  lotes,
  historico,
}: PainelProps) {
  const [aba, setAba] = useState<
    "plantios" | "lotes" | "historico"
  >("plantios");

  const abas = [
    { id: "plantios", titulo: "Plantios" },
    { id: "lotes", titulo: "Lotes" },
    { id: "historico", titulo: "Histórico" },
  ] as const;

  return (
    <section className="min-w-0">
      <nav
        aria-label="Visualização do cultivo"
        className="mb-6 flex gap-6 border-b border-slate-200"
      >
        {abas.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={aba === item.id}
            onClick={() => setAba(item.id)}
            className={`border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
              aba === item.id
                ? "border-[#486d6b] text-[#244b49]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.titulo}
          </button>
        ))}
      </nav>

      {aba === "plantios" && plantios}
      {aba === "lotes" && lotes}
      {aba === "historico" && historico}
    </section>
  );
}

type DetalhesProps = {
  titulo: string;
  children: ReactNode;
};

export function DetalhesCultivo({
  titulo,
  children,
}: DetalhesProps) {
  const [aberto, setAberto] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

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

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full rounded-lg border border-[#486d6b] px-4 py-2 text-sm font-semibold text-[#244b49] hover:bg-[#edf4f3]"
      >
        Ver detalhes
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={tituloId}
        onCancel={() => setAberto(false)}
        onClose={() => setAberto(false)}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-black/60"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <h2
            id={tituloId}
            className="text-xl font-bold text-[#244b49]"
          >
            {titulo}
          </h2>

          <button
            type="button"
            aria-label="Fechar detalhes"
            onClick={() => setAberto(false)}
            className="rounded-lg px-3 py-1 text-2xl text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </header>

        <div className="p-5">{children}</div>
      </dialog>
    </>
  );
}