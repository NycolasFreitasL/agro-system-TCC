"use client";

import {
  type FormEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Props = {
  nome: string;
  email: string;
};

type Acao = "dados" | "senha";

type Aviso = {
  acao: Acao;
  tipo: "sucesso" | "erro";
  mensagem: string;
};

const campo =
  "mt-2 w-full min-w-0 rounded-lg border border-slate-300 " +
  "bg-white px-3 py-3 text-sm text-slate-900 outline-none " +
  "focus:border-[#486d6b] focus:ring-2 focus:ring-[#486d6b]/20";

const botao =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 " +
  "rounded-lg bg-[#486d6b] px-5 py-3 text-sm font-semibold " +
  "text-white transition hover:bg-[#244b49] " +
  "disabled:cursor-wait disabled:opacity-60 sm:w-auto";

export default function PerfilFormulario({
  nome,
  email,
}: Props) {
  const router = useRouter();
  const enviandoRef = useRef(false);

  const [salvando, setSalvando] = useState<Acao | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  async function salvar(
    event: FormEvent<HTMLFormElement>,
    acao: Acao,
  ) {
    event.preventDefault();

    if (enviandoRef.current) return;

    const formulario = event.currentTarget;
    const formData = new FormData(formulario);

    enviandoRef.current = true;
    setSalvando(acao);
    setAviso(null);

    try {
      const corpo =
        acao === "dados"
          ? {
              acao,
              nome: formData.get("nome"),
              email: formData.get("email"),
              senhaAtual: formData.get("senhaAtual"),
            }
          : {
              acao,
              senhaAtual: formData.get("senhaAtual"),
              novaSenha: formData.get("novaSenha"),
              confirmacaoSenha: formData.get("confirmacaoSenha"),
            };

      const resposta = await fetch("/api/perfil", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(corpo),
      });

      if (resposta.status === 401) {
        window.location.replace("/login");
        return;
      }

      const dados = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(
          dados?.error || "Não foi possível salvar a alteração.",
        );
      }

      if (!dados) {
        throw new Error("O servidor retornou uma resposta inválida.");
      }

      if (dados.entrarNovamente) {
        window.location.replace("/login");
        return;
      }

      const senha = formulario.elements.namedItem("senhaAtual");

      if (senha instanceof HTMLInputElement) {
        senha.value = "";
      }

      setAviso({
        acao,
        tipo: "sucesso",
        mensagem: dados.message || "Alteração salva.",
      });

      router.refresh();
    } catch (error) {
      setAviso({
        acao,
        tipo: "erro",
        mensagem:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a alteração.",
      });
    } finally {
      enviandoRef.current = false;
      setSalvando(null);
    }
  }

  function mensagem(acao: Acao) {
    if (!aviso || aviso.acao !== acao) return null;

    return (
      <p
        role={aviso.tipo === "erro" ? "alert" : "status"}
        className={`mt-5 rounded-lg p-3 text-sm ${
          aviso.tipo === "erro"
            ? "bg-red-50 text-red-700"
            : "bg-green-50 text-green-800"
        }`}
      >
        {aviso.mensagem}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-[#244b49]">
            Dados pessoais
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Atualize seu nome e o e-mail utilizado para entrar.
          </p>
        </header>

        <form
          onSubmit={(event) => salvar(event, "dados")}
          className="p-5 sm:p-6"
        >
          <fieldset disabled={salvando !== null} className="min-w-0">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="text-sm font-semibold text-slate-700">
                  Nome completo
                </span>

                <input
                  name="nome"
                  required
                  maxLength={100}
                  autoComplete="name"
                  defaultValue={nome}
                  className={campo}
                />
              </label>

              <label className="block min-w-0">
                <span className="text-sm font-semibold text-slate-700">
                  E-mail
                </span>

                <input
                  name="email"
                  type="email"
                  required
                  maxLength={150}
                  autoComplete="email"
                  defaultValue={email}
                  className={campo}
                />
              </label>

              <label className="block min-w-0 sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Senha atual
                </span>

                <input
                  name="senhaAtual"
                  type="password"
                  autoComplete="current-password"
                  className={campo}
                  aria-describedby="aviso-email-perfil"
                />

                <span
                  id="aviso-email-perfil"
                  className="mt-2 block text-xs leading-5 text-slate-500"
                >
                  Necessária apenas se você alterar o e-mail.
                </span>
              </label>
            </div>

            {mensagem("dados")}

            <footer className="mt-6 flex justify-end border-t border-slate-100 pt-5">
              <button type="submit" className={botao}>
                <IconeSalvar />
                {salvando === "dados"
                  ? "Salvando..."
                  : "Salvar dados"}
              </button>
            </footer>
          </fieldset>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-[#244b49]">
            Alterar senha
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Após salvar, será necessário entrar novamente em todos
            os dispositivos, incluindo este.
          </p>
        </header>

        <form
          onSubmit={(event) => salvar(event, "senha")}
          className="p-5 sm:p-6"
        >
          <fieldset disabled={salvando !== null} className="min-w-0">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block min-w-0 sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Senha atual
                </span>

                <input
                  name="senhaAtual"
                  type="password"
                  required
                  autoComplete="current-password"
                  className={campo}
                />
              </label>

              <label className="block min-w-0">
                <span className="text-sm font-semibold text-slate-700">
                  Nova senha
                </span>

                <input
                  name="novaSenha"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className={campo}
                  aria-describedby="aviso-nova-senha"
                />
              </label>

              <label className="block min-w-0">
                <span className="text-sm font-semibold text-slate-700">
                  Confirme a nova senha
                </span>

                <input
                  name="confirmacaoSenha"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className={campo}
                />
              </label>
            </div>

            <p
              id="aviso-nova-senha"
              className="mt-3 text-xs leading-5 text-slate-500"
            >
              Use pelo menos 12 caracteres. Escolha uma senha
              exclusiva para sua conta.
            </p>

            {mensagem("senha")}

            <footer className="mt-6 flex justify-end border-t border-slate-100 pt-5">
              <button type="submit" className={botao}>
                <IconeSalvar />
                {salvando === "senha"
                  ? "Alterando..."
                  : "Alterar senha"}
              </button>
            </footer>
          </fieldset>
        </form>
      </section>
    </div>
  );
}

function IconeSalvar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" />
      <path d="M7 3v6h10V3M7 21v-8h10v8" />
    </svg>
  );
}