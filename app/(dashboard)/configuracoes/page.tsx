import Link from "next/link";
import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/app/lib/sessao";

export default async function ConfiguracoesPage() {
  const usuario = await obterUsuarioAtual();

  if (!usuario) {
    redirect("/login");
  }

  const proprietario = usuario.permissao_usuario === "PROPRIETARIO";

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <header className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#486d6b]">
          Administração do sistema
        </p>

        <h1 className="mt-2 text-2xl font-bold text-[#244b49] sm:text-3xl">
          Configurações
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Acesse as configurações da sua conta e da propriedade.
        </p>
      </header>

      <section
        aria-label="Opções de configuração"
        className="grid gap-5 md:grid-cols-2"
      >
        {proprietario && (
          <Link
            href="/usuarios"
            className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#486d6b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#486d6b]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f0ef] text-[#486d6b]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <circle cx="9" cy="8" r="3" />
                <path d="M3 21v-2a6 6 0 0 1 12 0v2" />
                <path d="M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2" />
              </svg>
            </span>

            <h2 className="mt-5 text-lg font-bold text-[#244b49]">
              Usuários e acessos
            </h2>

            <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">
              Cadastre funcionários e gerencie a ativação dos acessos ao
              sistema.
            </p>

            <span className="mt-6 flex items-center gap-2 text-sm font-semibold text-[#486d6b]">
              Gerenciar usuários
              <Seta />
            </span>
          </Link>
        )}
        <Link
          href="/perfil"
          className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#486d6b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#486d6b]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f0ef] text-[#486d6b]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
            </svg>
          </span>

          <h2 className="mt-5 text-lg font-bold text-[#244b49]">
            Perfil e segurança
          </h2>

          <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">
            Altere seu nome, e-mail, foto e senha de acesso.
          </p>

          <span className="mt-6 flex items-center gap-2 text-sm font-semibold text-[#486d6b]">
            Gerenciar minha conta
            <Seta />
          </span>
        </Link>

        {proprietario && (
          <Link
            href="/fazenda"
            className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#486d6b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#486d6b]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f0ef] text-[#486d6b]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path d="m3 10 9-7 9 7" />
                <path d="M5 9v12h14V9M9 21v-8h6v8" />
                <path d="m9 13 6 8m0-8-6 8" />
              </svg>
            </span>

            <h2 className="mt-5 text-lg font-bold text-[#244b49]">
              Fazenda e cadastros
            </h2>

            <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">
              Atualize os dados da propriedade e gerencie os lotes agrícolas e
              as espécies de animais.
            </p>

            <span className="mt-6 flex items-center gap-2 text-sm font-semibold text-[#486d6b]">
              Gerenciar fazenda
              <Seta />
            </span>
          </Link>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-[#244b49]">Acesso à conta</h2>

        <dl className="mt-5 divide-y divide-slate-100">
          <div className="grid gap-2 py-4 first:pt-0 sm:grid-cols-3">
            <dt className="text-sm font-semibold text-slate-700">
              E-mail de acesso
            </dt>

            <dd className="break-all text-sm text-slate-500 sm:col-span-2">
              {usuario.email}
            </dd>
          </div>

          <div className="grid gap-2 py-4 sm:grid-cols-3">
            <dt className="text-sm font-semibold text-slate-700">Permissão</dt>

            <dd className="text-sm text-slate-500 sm:col-span-2">
              {proprietario
                ? "Proprietário"
                : usuario.permissao_usuario === "FUNCIONARIO"
                  ? "Funcionário"
                  : usuario.permissao_usuario}
            </dd>
          </div>

          <div className="grid gap-2 py-4 sm:grid-cols-3">
            <dt className="text-sm font-semibold text-slate-700">
              Dispositivos
            </dt>

            <dd className="text-sm leading-6 text-slate-500 sm:col-span-2">
              Você pode utilizar a conta em mais de um dispositivo ao mesmo
              tempo.
            </dd>
          </div>

          <div className="grid gap-2 py-4 sm:grid-cols-3">
            <dt className="text-sm font-semibold text-slate-700">
              Troca de senha
            </dt>

            <dd className="text-sm leading-6 text-slate-500 sm:col-span-2">
              Ao alterar a senha, os acessos anteriores são invalidados. Será
              necessário entrar novamente.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function Seta() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 transition-transform group-hover:translate-x-1"
      aria-hidden="true"
    >
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}
