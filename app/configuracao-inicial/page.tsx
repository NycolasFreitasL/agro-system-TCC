"use client";

import { type FormEvent, useRef, useState } from "react";

const estiloCampo =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white " +
  "px-4 py-3 text-sm text-slate-800 outline-none " +
  "focus:border-[#486d6b] focus:ring-2 focus:ring-[#486d6b]/15";

export default function ConfiguracaoInicialPage() {
  const enviandoRef = useRef(false);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (enviandoRef.current) return;

    const formulario = event.currentTarget;
    const dados = new FormData(formulario);

    setErro("");
    enviandoRef.current = true;
    setCarregando(true);

    try {
      const resposta = await fetch("/api/configuracao-inicial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: dados.get("nome"),
          email: dados.get("email"),
          senha: dados.get("senha"),
          confirmacao: dados.get("confirmacao"),
          chave: dados.get("chave"),
        }),
      });

      const resultado = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(
          resultado?.error ||
            "Não foi possível cadastrar o proprietário.",
        );
      }

      formulario.reset();

      setSucesso(
        "Proprietário cadastrado com sucesso. Abra a página de login e entre com o e-mail e a senha que acabou de criar.",
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro inesperado.",
      );
    } finally {
      enviandoRef.current = false;
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f5f5f5] px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-[#486d6b]">
            AgroSystem
          </p>

          <h1 className="mt-2 text-2xl font-bold text-[#123e40]">
            Cadastro do proprietário
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Crie a conta responsável pela administração da fazenda.
          </p>
        </div>

        {sucesso ? (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"
          >
            {sucesso}
          </p>
        ) : (
          <form onSubmit={cadastrar} aria-busy={carregando}>
            <fieldset
              disabled={carregando}
              className="min-w-0 space-y-4"
            >
              <label className="block text-sm font-medium text-slate-700">
                Nome
                <input
                  name="nome"
                  required
                  maxLength={100}
                  autoComplete="name"
                  className={estiloCampo}
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                E-mail
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={150}
                  autoComplete="email"
                  className={estiloCampo}
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Senha
                <input
                  name="senha"
                  type="password"
                  required
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  className={estiloCampo}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Use pelo menos 12 caracteres.
                </span>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Confirmar senha
                <input
                  name="confirmacao"
                  type="password"
                  required
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  className={estiloCampo}
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Chave de configuração
                <input
                  name="chave"
                  type="password"
                  required
                  autoComplete="off"
                  className={estiloCampo}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Chave fornecida pelo responsável pela instalação.
                </span>
              </label>

              {erro && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-4 text-sm font-normal text-red-700"
                >
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={carregando}
                className="w-full rounded-xl bg-[#486d6b] px-5 py-3 font-semibold text-white hover:bg-[#365452] disabled:cursor-wait disabled:opacity-60"
              >
                {carregando
                  ? "Criando conta..."
                  : "Cadastrar proprietário"}
              </button>
            </fieldset>
          </form>
        )}
      </section>
    </main>
  );
}