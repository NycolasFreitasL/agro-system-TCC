import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import Sidebar from "@/app/components/sidebar";
import { obterUsuarioAtual } from "@/app/lib/sessao";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const usuario = await obterUsuarioAtual();

  if (!usuario) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh bg-slate-100">
      <Sidebar
        usuario={{
          nome: usuario.nome_usuario,
          permissao: usuario.permissao_usuario,
          foto: usuario.foto_perfil,
        }}
      />

      <div className="min-w-0 md:pl-60">
        <main className="w-full min-w-0 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}