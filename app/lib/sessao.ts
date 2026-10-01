import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/app/lib/prisma";

const NOME_COOKIE = "agrosystem_sessao";
const DURACAO_SEGUNDOS = 8 * 60 * 60;

const EMISSOR = "agrosystem";
const DESTINATARIO = "agrosystem-web";

function obterChave() {
  const segredo = process.env.SESSION_SECRET;

  if (!segredo || segredo.length < 64) {
    throw new Error(
      "Configure SESSION_SECRET com a chave gerada no terminal.",
    );
  }

  return new TextEncoder().encode(segredo);
}

export class ErroAutenticacao extends Error {
  constructor(
    mensagem = "Sua sessão expirou. Entre novamente.",
    public status = 401,
  ) {
    super(mensagem);
  }
}

export async function criarSessao(idUsuario: number) {
  if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
    throw new Error("Identificador de usuário inválido.");
  }

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(idUsuario))
    .setIssuer(EMISSOR)
    .setAudience(DESTINATARIO)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(obterChave());

  const cookieStore = await cookies();

  cookieStore.set(NOME_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SEGUNDOS,
  });
}

export async function encerrarSessao() {
  const cookieStore = await cookies();

  cookieStore.set(NOME_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function obterUsuarioAtual() {
  const cookieStore = await cookies();
  const token = cookieStore.get(NOME_COOKIE)?.value;

  if (!token) {
    return null;
  }

  // Erro de configuração não deve ser confundido com sessão expirada.
  const chave = obterChave();

  let idUsuario: number;

  try {
    const { payload } = await jwtVerify(token, chave, {
      algorithms: ["HS256"],
      issuer: EMISSOR,
      audience: DESTINATARIO,
      requiredClaims: ["sub", "iat", "exp"],
      maxTokenAge: "8h",
    });

    if (
      typeof payload.sub !== "string" ||
      !/^\d+$/.test(payload.sub)
    ) {
      return null;
    }

    idUsuario = Number(payload.sub);

    if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
      return null;
    }
  } catch {
    return null;
  }

  return prisma.usuarios.findUnique({
    where: {
      id_usuario: idUsuario,
    },
    select: {
      id_usuario: true,
      nome_usuario: true,
      email: true,
      permissao_usuario: true,
      foto_perfil: true,
    },
  });
}

export async function exigirUsuario() {
  const usuario = await obterUsuarioAtual();

  if (!usuario) {
    throw new ErroAutenticacao();
  }

  return usuario;
}

export async function exigirProprietario() {
  const usuario = await exigirUsuario();

  if (usuario.permissao_usuario !== "PROPRIETARIO") {
    throw new ErroAutenticacao(
      "Somente o proprietário pode administrar os dados da fazenda.",
      403,
    );
  }

  return usuario;
}