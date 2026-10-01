import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/app/lib/sessao";

export default async function HomePage() {
  const usuario = await obterUsuarioAtual();

  if (!usuario) {
    redirect("/login");
  }

  redirect("/dashboard");
}