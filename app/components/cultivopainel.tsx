"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import UiIcon from "@/app/components/ui-icon";
import styles from "./cultivo-tabs.module.css";

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
        className={styles.tabs}
      >
        {abas.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={aba === item.id}
            onClick={() => setAba(item.id)}
            className={styles.tab}
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
        className="fixed inset-0 m-auto max-h-[90dvh] w-[92vw] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-black/60"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <h2
            id={tituloId}
            className="min-w-0 break-words text-xl font-bold text-[#244b49]"
          >
            {titulo}
          </h2>

          <button
            type="button"
            aria-label="Fechar detalhes"
            onClick={() => setAberto(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <UiIcon nome="fechar" />
          </button>
        </header>

        <div className="p-5">{children}</div>
      </dialog>
    </>
  );
}
