"use client";

import {
  type FormEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Usuario = {
  id: number;
  nome: string;
  email: string;
  permissao: string;
  ativo: boolean;
};

type Props = {
  usuarios: Usuario[];
  idUsuarioAtual: number;
};

const campo =
  "mt-2 w-full min-w-0 rounded-lg border border-slate-300 " +
  "bg-white px-3 py-3 text-sm text-slate-900 outline-none " +
  "focus:border-[#486d6b] focus:ring-2 focus:ring-[#486d6b]/20";

export default function UsuariosPainel({
  usuarios,
  idUsuarioAtual,
}: Props) {
  const router = useRouter();
  const enviandoRef = useRef(false);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [busca, setBusca] = useState("");

  const termo = normalizar(busca.trim());

  const filtrados = usuarios.filter((usuario) =>
    normalizar(`${usuario.nome} ${usuario.email}`).includes(termo),
  );

  async function enviar(
    metodo: "POST" | "PATCH",
    corpo: Record<string, unknown>,
  ): Promise<boolean> {
    if (enviandoRef.current) return false;

    enviandoRef.current = true;
    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const resposta = await fetch("/api/usuarios", {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(corpo),
      });

      if (resposta.status === 401) {
        window.location.replace("/login");
        return false;
      }

      const dados = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(
          dados?.error || "Não foi possível concluir a operação.",
        );
      }

      if (!dados) {
        throw new Error("O servidor retornou uma resposta inválida.");
      }

      setSucesso(dados.message || "Operação concluída.");
      router.refresh();

      return true;
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a operação.",
      );

      return false;
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formulario = event.currentTarget;
    const dados = new FormData(formulario);

    const cadastrado = await enviar("POST", {
      nome: dados.get("nome"),
      email: dados.get("email"),
      senha: dados.get("senha"),
      confirmacaoSenha: dados.get("confirmacaoSenha"),
    });

    if (cadastrado) {
      formulario.reset();
    }
  }

  async function alterarAcesso(usuario: Usuario) {
    if (enviandoRef.current) return;

    const mensagem = usuario.ativo
      ? `Desativar o acesso de ${usuario.nome}? O histórico será preservado, mas essa pessoa não poderá utilizar o sistema.`
      : `Reativar o acesso de ${usuario.nome}?`;

    if (!window.confirm(mensagem)) return;

    await enviar("PATCH", {
      idUsuario: usuario.id,
      ativo: !usuario.ativo,
    });
  }

  return (
    <div className="space-y-6">
      {erro && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {erro}
        </p>
      )}

      {sucesso && (
        <p
          role="status"
          className="rounded-xl bg-green-50 p-4 text-sm text-green-800"
        >
          {sucesso}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-[#244b49]">
            Cadastrar funcionário
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            O funcionário terá acesso às operações de estoque,
            cultivo e animais, além do próprio perfil.
          </p>
        </header>

        <form onSubmit={cadastrar} className="p-5 sm:p-6">
          <fieldset disabled={salvando} className="min-w-0">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="text-sm font-semibold text-slate-700">
                  Nome completo
                </span>

                <input
                  name="nome"
                  required
                  maxLength={100}
                  autoComplete="off"
                  className={campo}
                />
              </label>

              <label className="block min-w-0">
                <span className="text-sm font-semibold text-slate-700">
                  E-mail de acesso
                </span>

                <input
                  name="email"
                  type="email"
                  required
                  maxLength={150}
                  autoComplete="off"
                  className={campo}
                />
              </label>

              <label className="block min-w-0">
                <span className="text-sm font-semibold text-slate-700">
                  Senha inicial
                </span>

                <input
                  name="senha"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className={campo}
                />
              </label>

              <label className="block min-w-0">
                <span className="text-sm font-semibold text-slate-700">
                  Confirme a senha
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

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Use pelo menos 12 caracteres. Oriente o funcionário
              a alterar a senha em Meu perfil após entrar.
            </p>

            <footer className="mt-6 flex justify-end border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={salvando}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#486d6b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#244b49] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>

                {salvando ? "Aguarde..." : "Cadastrar funcionário"}
              </button>
            </footer>
          </fieldset>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-[#244b49]">
            Usuários cadastrados
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {filtrados.length} de {usuarios.length} usuários
          </p>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-slate-700">
              Buscar usuário
            </span>

            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Nome ou e-mail"
              className={campo}
            />
          </label>
        </header>

        {filtrados.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Nenhum usuário encontrado.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtrados.map((usuario) => {
              const podeAlterar =
                usuario.id !== idUsuarioAtual &&
                usuario.permissao === "FUNCIONARIO";

              const permissao =
                usuario.permissao === "PROPRIETARIO"
                  ? "Proprietário"
                  : usuario.permissao === "FUNCIONARIO"
                    ? "Funcionário"
                    : usuario.permissao;

              return (
                <li
                  key={usuario.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-800">
                      {usuario.nome}
                      {usuario.id === idUsuarioAtual && (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          Você
                        </span>
                      )}
                    </p>

                    <p className="mt-1 break-all text-sm text-slate-500">
                      {usuario.email}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {permissao}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          usuario.ativo
                            ? "bg-green-50 text-green-800"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {usuario.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>

                  {podeAlterar && (
                    <button
                      type="button"
                      onClick={() => alterarAcesso(usuario)}
                      disabled={salvando}
                      aria-label={`${
                        usuario.ativo ? "Desativar" : "Reativar"
                      } acesso de ${usuario.nome}`}
                      className={`min-h-11 shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${
                        usuario.ativo
                          ? "border-red-200 text-red-700 hover:bg-red-50"
                          : "border-[#486d6b] text-[#486d6b] hover:bg-[#edf4f3]"
                      }`}
                    >
                      {usuario.ativo
                        ? "Desativar acesso"
                        : "Reativar acesso"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}