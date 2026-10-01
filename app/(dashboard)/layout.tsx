import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import Sidebar from "../components/sidebar";
import { obterUsuarioAtual } from "@/app/lib/sessao";

// Use "/" se a tela de login estiver em app/page.tsx.
// Use "/login" se estiver em app/login/page.tsx.
const PAGINA_LOGIN = "/login";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const usuario = await obterUsuarioAtual();

  if (!usuario) {
    redirect(PAGINA_LOGIN);
  }

  return (
    <div className="min-h-dvh bg-slate-100">
      <Sidebar />

      <div className="min-w-0 md:pl-60">
        <main className="w-full min-w-0 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}