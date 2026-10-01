"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const formularioId = useId();
  const enviandoRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const emailId = `${formularioId}-email`;
  const senhaId = `${formularioId}-senha`;
  const erroId = `${formularioId}-erro`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (enviandoRef.current) return;

    const emailValue = email.trim();

    if (!emailValue) {
      setError("O campo de e-mail é obrigatório.");
      return;
    }

    if (!password) {
      setError("O campo de senha é obrigatório.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setError("Por favor, insira um e-mail válido.");
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);
    setError("");

    let loginConcluido = false;

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: emailValue, password }),
      }).catch(() => {
        throw new Error(
          "Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.",
        );
      });

      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("O servidor retornou uma resposta inválida. Tente novamente.");
      }

      const data: unknown = await response.json().catch(() => {
        throw new Error("O servidor retornou uma resposta inválida. Tente novamente.");
      });

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("O servidor retornou uma resposta inválida. Tente novamente.");
      }

      if (!response.ok) {
        throw new Error(
          "error" in data && typeof data.error === "string" && data.error.trim()
            ? data.error
            : "Erro ao fazer login. Por favor, tente novamente.",
        );
      }

      if (
        "error" in data ||
        !("message" in data) ||
        typeof data.message !== "string" ||
        !data.message.trim()
      ) {
        throw new Error("O servidor retornou uma resposta inválida. Tente novamente.");
      }

      router.replace("/dashboard");
      router.refresh();
      loginConcluido = true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      // Mantém o bloqueio após o sucesso até a navegação terminar.
      if (!loginConcluido) {
        enviandoRef.current = false;
        setEnviando(false);
      }
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <section className={styles.presentation} aria-label="Apresentação do AgroSystem">
          <div className={styles.brand}>
            <span className={styles.brandMark}><MarcaAgro /></span>
            <span className={styles.brandName}>AgroSystem</span>
          </div>
          <div className={styles.presentationContent}>
            <h2 className={styles.tagline}>Gestão rural,<br />com clareza.</h2>
            <p className={styles.presentationText}>Organização para acompanhar o dia a dia da sua fazenda.</p>
            <PaisagemRural />
          </div>
        </section>

        <section className={styles.formSection} aria-labelledby={`${formularioId}-titulo`}>
          <header className={styles.formHeader}>
            <h1 id={`${formularioId}-titulo`} className={styles.title}>Entrar no AgroSystem</h1>
            <p className={styles.description}>Acesse sua conta para continuar a gestão da fazenda.</p>
          </header>

          <form onSubmit={handleSubmit} noValidate aria-busy={enviando}
            aria-describedby={error ? erroId : undefined} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor={emailId}>E-mail</label>
              <input id={emailId} name="email" className={styles.input} type="email"
                autoComplete="username" autoCapitalize="none" spellCheck={false}
                placeholder="seuemail@exemplo.com" required value={email} disabled={enviando}
                onChange={(event) => setEmail(event.target.value)} />
            </div>

            <div className={styles.field}>
              <label htmlFor={senhaId}>Senha</label>
              <div className={styles.passwordField}>
                <input id={senhaId} name="password" className={`${styles.input} ${styles.passwordInput}`}
                  type={mostrarSenha ? "text" : "password"} autoComplete="current-password"
                  placeholder="Digite sua senha" required value={password} disabled={enviando}
                  onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className={styles.passwordToggle}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  aria-controls={senhaId} aria-pressed={mostrarSenha} disabled={enviando}
                  onClick={() => setMostrarSenha((visivel) => !visivel)}>
                  <IconeLogin nome={mostrarSenha ? "olho-fechado" : "olho"} />
                </button>
              </div>
            </div>

            {error && (
              <div id={erroId} role="alert" className={styles.error}>
                <IconeLogin nome="alerta" />
                <p>{error}</p>
              </div>
            )}

            <button className={styles.submit} type="submit" disabled={enviando}>
              <span>{enviando ? "Entrando..." : "Entrar"}</span>
              {!enviando && <IconeLogin nome="entrar" />}
            </button>
          </form>
          <p className={styles.accessHint}>Use o acesso fornecido pelo proprietário da fazenda.</p>
        </section>
      </div>
    </main>
  );
}

function MarcaAgro() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 27V15M16 19C8 19 5 14 5 7c7 0 11 4 11 12ZM16 16C16 9 20 5 27 5c0 7-4 11-11 11ZM9 27h14" />
    </svg>
  );
}

function PaisagemRural() {
  return (
    <svg className={styles.landscape} aria-hidden="true" viewBox="0 0 400 220" fill="none">
      <path d="M8 165c50-39 111-53 170-37 60 17 138-12 214-39v123H8Z" fill="#dce9e2" />
      <path d="M8 184c113-56 220-29 384 20M8 206c144-54 253-36 384 7M102 147c92 17 186 25 290-12" stroke="#8ca99b" strokeWidth="2" strokeLinecap="round" />
      <circle cx="313" cy="44" r="19" stroke="#8ca99b" strokeWidth="2" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m87 106 57-45 57 45M100 97v59h88V97" fill="#edf3f1" />
        <path d="M132 156v-39h25v39M114 107h9v12h-9zM166 107h9v12h-9z" />
        <path d="M53 157v-32M53 140c-12 0-18-7-18-17 12 0 18 7 18 17ZM53 132c0-12 7-19 18-19 0 12-7 19-18 19Z" />
        <path d="M226 146v-26M226 134c-10 0-15-6-15-14 10 0 15 6 15 14ZM226 128c0-10 6-16 15-16 0 10-6 16-15 16Z" />
      </g>
    </svg>
  );
}

function IconeLogin({ nome }: { nome: "olho" | "olho-fechado" | "entrar" | "alerta" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {nome === "olho" && <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
      {nome === "olho-fechado" && <><path d="m3 3 18 18M10.5 5.1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3 3.9M6 6C3.4 8.1 2 12 2 12s3.5 7 10 7c2.4 0 4.5-.9 6.2-2.1M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>}
      {nome === "entrar" && <path d="M4 12h15m-5-5 5 5-5 5" />}
      {nome === "alerta" && <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></>}
    </svg>
  );
}
