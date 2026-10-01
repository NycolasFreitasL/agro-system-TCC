import { redirect } from "next/navigation";
import { obterUsuarioAtual } from "@/app/lib/sessao";

export default async function ConfiguracoesPage() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  redirect("/perfil");
}
