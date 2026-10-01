"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type IconeNome =
  | "dashboard"
  | "animais"
  | "cultivo"
  | "estoque"
  | "fazenda"
  | "sair";

type ItemMenu = {
  href: string;
  titulo: string;
  icone: IconeNome;
};

type SidebarProps = {
  usuario: {
    nome: string;
    permissao: string;
  };
};

const itensPrincipais: ItemMenu[] = [
  {
    href: "/dashboard",
    titulo: "Dashboard",
    icone: "dashboard",
  },
  {
    href: "/estoque",
    titulo: "Estoque",
    icone: "estoque",
  },
  {
    href: "/plantio",
    titulo: "Cultivo",
    icone: "cultivo",
  },
  {
    href: "/animais",
    titulo: "Animais",
    icone: "animais",
  },
];

export default function Sidebar({
  usuario,
}: SidebarProps) {
  const pathname = usePathname();

  const [menuAberto, setMenuAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState("");

  const botaoRef = useRef<HTMLButtonElement>(null);
  const saindoRef = useRef(false);
  const navegacaoId = useId();

  const proprietario =
    usuario.permissao === "PROPRIETARIO";

  const iniciais = usuario.nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!menuAberto) return;

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuAberto(false);
        botaoRef.current?.focus();
      }
    }

    window.addEventListener("keydown", fecharComEscape);

    return () => {
      window.removeEventListener("keydown", fecharComEscape);
    };
  }, [menuAberto]);

  async function sair() {
    if (saindoRef.current) return;

    saindoRef.current = true;
    setSaindo(true);
    setErro("");

    try {
      const resposta = await fetch("/api/auth/sair", {
        method: "POST",
      });

      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);

        throw new Error(
          dados?.error || "Não foi possível sair.",
        );
      }

      // Navegação completa para descartar o estado da área autenticada.
      window.location.replace("/login");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível sair. Tente novamente.",
      );

      saindoRef.current = false;
      setSaindo(false);
    }
  }

  function renderizarItem(item: ItemMenu) {
    const ativo =
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`);

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={ativo ? "page" : undefined}
          onClick={() => setMenuAberto(false)}
          className={
            "flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 " +
            "text-sm font-semibold transition-colors " +
            "focus-visible:outline-2 focus-visible:outline-offset-2 " +
            "focus-visible:outline-[#486d6b] " +
            (ativo
              ? "bg-[#486d6b] text-white"
              : "text-slate-600 hover:bg-[#edf4f3] hover:text-[#244b49]")
          }
        >
          <Icone nome={item.icone} />
          <span>{item.titulo}</span>
        </Link>
      </li>
    );
  }

  return (
    <aside className="sticky top-0 z-30 flex max-h-dvh w-full flex-col border-b border-slate-200 bg-white md:fixed md:inset-y-0 md:left-0 md:h-dvh md:w-60 md:border-b-0 md:border-r">
      <div className="flex shrink-0 items-center justify-between gap-3 p-4 md:px-5 md:py-7">
        <Link
          href="/dashboard"
          onClick={() => setMenuAberto(false)}
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#486d6b]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#244b49] text-white">
            <Icone nome="cultivo" />
          </span>

          <span className="text-lg font-bold tracking-tight text-[#244b49]">
            AgroSystem
          </span>
        </Link>

        <button
          ref={botaoRef}
          type="button"
          aria-expanded={menuAberto}
          aria-controls={navegacaoId}
          aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMenuAberto((aberto) => !aberto)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-[#244b49] hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#486d6b] md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            {menuAberto ? (
              <path d="m6 6 12 12M18 6 6 18" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      <div
        id={navegacaoId}
        className={
          "min-h-0 overflow-y-auto md:flex md:flex-1 md:flex-col " +
          (menuAberto ? "flex flex-col" : "hidden")
        }
      >
        <nav
          aria-label="Navegação principal"
          className="px-3 pb-5 md:flex-1"
        >
          <p className="mb-3 px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Gestão da propriedade
          </p>

          <ul className="space-y-2">
            {itensPrincipais.map(renderizarItem)}
          </ul>

          {proprietario && (
            <>
              <p className="mb-3 mt-7 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Administração
              </p>

              <ul className="space-y-2">
                {renderizarItem({
                  href: "/fazenda",
                  titulo: "Fazenda",
                  icone: "fazenda",
                })}
              </ul>
            </>
          )}
        </nav>

        <footer className="shrink-0 border-t border-slate-100 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#486d6b]/10 text-sm font-bold text-[#486d6b]"
            >
              {iniciais || "U"}
            </div>

            <div className="min-w-0">
              <p
                title={usuario.nome}
                className="truncate text-sm font-semibold text-[#244b49]"
              >
                {usuario.nome}
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                {proprietario
                  ? "Proprietário"
                  : usuario.permissao === "FUNCIONARIO"
                    ? "Funcionário"
                    : usuario.permissao}
              </p>
            </div>
          </div>

          {erro && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700"
            >
              {erro}
            </p>
          )}

          <button
            type="button"
            onClick={sair}
            disabled={saindo}
            className="mt-4 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#486d6b] disabled:cursor-wait disabled:opacity-50"
          >
            <Icone nome="sair" />
            {saindo ? "Saindo..." : "Sair"}
          </button>
        </footer>
      </div>
    </aside>
  );
}

function Icone({ nome }: { nome: IconeNome }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      {nome === "dashboard" && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
      )}

      {nome === "estoque" && (
        <>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="M3 8v9l9 5 9-5V8" />
          <path d="M12 13v9M7.5 5.5l9 5" />
        </>
      )}

      {nome === "cultivo" && (
        <>
          <path d="M12 21v-9" />
          <path d="M12 14C5 14 3 10 3 5c6 0 9 3 9 9Z" />
          <path d="M12 11c0-6 3-9 9-9 0 6-3 9-9 9Z" />
          <path d="M6 21h12" />
        </>
      )}

      {nome === "animais" && (
        <>
          <path d="M7 8 3 5v6l4 2M17 8l4-3v6l-4 2" />
          <path d="M7 8c2-2 8-2 10 0v9c0 3-10 3-10 0V8Z" />
          <path d="M8 7 6 3M16 7l2-4" />
          <path d="M9 12h.01M15 12h.01" />
          <rect x="8" y="15" width="8" height="5" rx="2" />
        </>
      )}

      {nome === "fazenda" && (
        <>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v12h14V9" />
          <path d="M9 21v-8h6v8M3 21h18" />
        </>
      )}

      {nome === "sair" && (
        <>
          <path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
          <path d="M9 12h12m-4-4 4 4-4 4" />
        </>
      )}
    </svg>
  );
}