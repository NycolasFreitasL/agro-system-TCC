import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/app/lib/sessao";
import PerfilFormulario from "@/app/components/perfil-formulario";
import PerfilFoto from "@/app/components/perfil-foto";

export default async function PerfilPage() {
  const usuario = await obterUsuarioAtual();

  if (!usuario) {
    redirect("/login");
  }

  const permissao =
    usuario.permissao_usuario === "PROPRIETARIO"
      ? "Proprietário"
      : usuario.permissao_usuario === "FUNCIONARIO"
        ? "Funcionário"
        : usuario.permissao_usuario;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <header className="mb-7 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ef] text-[#486d6b]">
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

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#486d6b]">
            Minha conta
          </p>

          <h1 className="mt-1 text-2xl font-bold text-[#244b49] sm:text-3xl">
            Meu perfil
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Gerencie seus dados pessoais, sua foto e sua senha.
          </p>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="break-words text-lg font-bold text-[#244b49]">
          {usuario.nome_usuario}
        </p>

        <p className="mt-1 break-all text-sm text-slate-500">
          {usuario.email}
        </p>

        <span className="mt-3 inline-flex rounded-full bg-[#e8f0ef] px-3 py-1 text-xs font-semibold text-[#244b49]">
          {permissao}
        </span>
      </section>

      <PerfilFoto
        nome={usuario.nome_usuario}
        fotoAtual={usuario.foto_perfil}
      />

      <PerfilFormulario
        nome={usuario.nome_usuario}
        email={usuario.email}
      />
    </div>
  );
}