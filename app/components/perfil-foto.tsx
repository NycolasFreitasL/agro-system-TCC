"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Props = {
  nome: string;
  fotoAtual: string | null;
};

export default function PerfilFoto({ nome, fotoAtual }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const enviandoRef = useRef(false);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    if (!arquivo) {
      setPrevia(null);
      return;
    }

    const url = URL.createObjectURL(arquivo);
    setPrevia(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [arquivo]);

  function selecionar(event: ChangeEvent<HTMLInputElement>) {
    const foto = event.target.files?.[0];

    setErro("");
    setSucesso("");

    if (!foto) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(foto.type)) {
      setErro("Selecione uma imagem JPG, PNG ou WebP.");
      event.target.value = "";
      setArquivo(null);
      return;
    }

    if (foto.size === 0 || foto.size > 4 * 1024 * 1024) {
      setErro("Selecione uma foto de até 4 MB.");
      event.target.value = "";
      setArquivo(null);
      return;
    }

    setArquivo(foto);
  }

  function cancelarSelecao() {
    setArquivo(null);
    setErro("");
    setSucesso("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!arquivo || enviandoRef.current) return;

    enviandoRef.current = true;
    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const formulario = new FormData();
      formulario.append("foto", arquivo);

      const resposta = await fetch("/api/perfil/foto", {
        method: "POST",
        body: formulario,
      });

      if (resposta.status === 401) {
        window.location.replace("/login");
        return;
      }

      const dados = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(dados?.error || "Não foi possível atualizar a foto.");
      }

      if (typeof dados?.foto !== "string") {
        throw new Error("O servidor retornou uma resposta inválida.");
      }

      setSucesso("Foto salva. Você já pode sair desta página.");
      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a foto.",
      );
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  const imagem = previa || fotoAtual;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-[#244b49]">Foto do perfil</h2>

      <p className="mt-1 text-sm text-slate-500">
        Escolha uma imagem JPG, PNG ou WebP de até 4 MB.
      </p>

      <form onSubmit={salvar} className="mt-5">
        <fieldset
          disabled={salvando}
          className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center"
        >
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-[#e8f0ef] text-[#486d6b]">
            {imagem ? (
              <img
                src={imagem}
                alt={`Foto de ${nome}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-11 w-11"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
              </svg>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Selecionar foto
              </span>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={selecionar}
                className="mt-2 block w-full min-w-0 text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#e8f0ef] file:px-4 file:py-3 file:font-semibold file:text-[#244b49] disabled:opacity-60"
              />
            </label>

            {arquivo && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={salvando || Boolean(sucesso)}
                  className="min-h-11 rounded-lg bg-[#486d6b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#244b49] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvando ? "Enviando..." : "Salvar foto"}
                </button>

                <button
                  type="button"
                  onClick={cancelarSelecao}
                  className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {sucesso ? "Limpar seleção" : "Cancelar seleção"}
                </button>
              </div>
            )}
          </div>
        </fieldset>

        {erro && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {erro}
          </p>
        )}

        {sucesso && (
          <p
            role="status"
            className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800"
          >
            {sucesso}
          </p>
        )}
      </form>
    </section>
  );
}
