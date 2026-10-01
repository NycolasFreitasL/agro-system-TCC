import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/app/lib/prisma";
import { obterUsuarioAtual } from "@/app/lib/sessao";
import UsuariosPainel from "@/app/components/usuarios-painel";

export default async function UsuariosPage() {
  const usuarioAtual = await obterUsuarioAtual();

  if (!usuarioAtual) {
    redirect("/login");
  }

  // Verifica a permissão antes de consultar os usuários.
  if (usuarioAtual.permissao_usuario !== "PROPRIETARIO") {
    redirect("/dashboard");
  }

  const usuarios = await prisma.usuarios.findMany({
    select: {
      id_usuario: true,
      nome_usuario: true,
      email: true,
      permissao_usuario: true,
      ativo: true,
    },
    orderBy: {
      nome_usuario: "asc",
    },
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <header className="mb-7">
        <Link
          href="/configuracoes"
          className="text-sm font-semibold text-[#486d6b] hover:underline"
        >
          Voltar às configurações
        </Link>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-[#486d6b]">
          Administração
        </p>

        <h1 className="mt-2 text-2xl font-bold text-[#244b49] sm:text-3xl">
          Usuários
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Cadastre funcionários e controle quem pode acessar
          o AgroSystem. Desativar um acesso preserva o histórico
          das operações realizadas.
        </p>
      </header>

      <UsuariosPainel
        idUsuarioAtual={usuarioAtual.id_usuario}
        usuarios={usuarios.map((usuario) => ({
          id: usuario.id_usuario,
          nome: usuario.nome_usuario,
          email: usuario.email,
          permissao: usuario.permissao_usuario,
          ativo: usuario.ativo,
        }))}
      />
    </div>
  );
}