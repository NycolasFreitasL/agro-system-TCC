"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Props = {
  idPlantio: number;
  nomeCultura: string;
  possuiColheita: boolean;
};

export default function EncerrarCultivo({
  idPlantio,
  nomeCultura,
  possuiColheita,
}: Props) {
  const router = useRouter();
  const tituloId = useId();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const enviandoRef = useRef(false);

  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function fechar() {
    if (enviandoRef.current) return;

    setAberto(false);
    setErro("");
  }

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

  async function encerrar() {
    if (enviandoRef.current) return;

    enviandoRef.current = true;
    setSalvando(true);
    setErro("");

    try {
      const resposta = await fetch("/api/plantios/encerrar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idPlantio }),
      });

      if (
        !resposta.headers
          .get("content-type")
          ?.includes("application/json")
      ) {
        throw new Error(
          "A API de encerramento não respondeu corretamente.",
        );
      }

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.error || "Não foi possível encerrar o cultivo.",
        );
      }

      setAberto(false);
      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível encerrar o cultivo.",
      );
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={!possuiColheita}
        onClick={() => {
          setErro("");
          setAberto(true);
        }}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Encerrar cultivo
      </button>

      {!possuiColheita && (
        <p className="mt-2 text-xs text-slate-500">
          Disponível após registrar uma colheita.
        </p>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={tituloId}
        onCancel={(event) => {
          event.preventDefault();
          fechar();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[92vw] max-w-md overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-black/60"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2
              id={tituloId}
              className="text-xl font-bold text-[#244b49]"
            >
              Encerrar cultivo
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {nomeCultura} · Plantio #{idPlantio}
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar confirmação"
            onClick={fechar}
            disabled={salvando}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <div className="p-5">
          <p className="text-sm leading-6 text-slate-600">
            Confirme que a última colheita já foi registrada.
            O cultivo será concluído e a área ficará disponível
            para outro plantio.
          </p>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Os registros permanecerão no histórico. Novas
            colheitas desse cultivo serão bloqueadas.
          </p>

          {erro && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {erro}
            </p>
          )}

          <footer className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={fechar}
              disabled={salvando}
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              Manter ativo
            </button>

            <button
              type="button"
              onClick={encerrar}
              disabled={salvando}
              className="rounded-lg bg-[#486d6b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#244b49] disabled:opacity-50"
            >
              {salvando ? "Encerrando…" : "Confirmar encerramento"}
            </button>
          </footer>
        </div>
      </dialog>
    </div>
  );
}