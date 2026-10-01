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
    mensagem = "Sua sessão expirou ou seu acesso foi desativado. Entre novamente.",
    public status = 401,
  ) {
    super(mensagem);
    this.name = "ErroAutenticacao";
  }
}

export async function criarSessao(
  idUsuario: number,
  versaoEsperada?: number,
) {
  if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
    throw new ErroAutenticacao();
  }

  const usuario = await prisma.usuarios.findUnique({
    where: {
      id_usuario: idUsuario,
    },
    select: {
      id_usuario: true,
      versao_sessao: true,
      ativo: true,
    },
  });

  if (!usuario || !usuario.ativo) {
    throw new ErroAutenticacao();
  }

  // Evita criar uma sessão caso a senha ou o acesso
  // tenham mudado durante a autenticação.
  if (
    versaoEsperada !== undefined &&
    usuario.versao_sessao !== versaoEsperada
  ) {
    throw new ErroAutenticacao(
      "Os dados de acesso foram alterados. Entre novamente.",
    );
  }

  const token = await new SignJWT({
    versao: usuario.versao_sessao,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(usuario.id_usuario))
    .setIssuer(EMISSOR)
    .setAudience(DESTINATARIO)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(obterChave());

  const armazenamento = await cookies();

  armazenamento.set(NOME_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SEGUNDOS,
  });
}

export async function encerrarSessao() {
  const armazenamento = await cookies();

  armazenamento.set(NOME_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function obterUsuarioAtual() {
  const armazenamento = await cookies();
  const token = armazenamento.get(NOME_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const chave = obterChave();

  let idUsuario: number;
  let versaoSessao: number;

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

    if (
      !Number.isSafeInteger(idUsuario) ||
      idUsuario <= 0
    ) {
      return null;
    }

    if (
      typeof payload.versao !== "number" ||
      !Number.isSafeInteger(payload.versao) ||
      payload.versao < 0
    ) {
      return null;
    }

    versaoSessao = payload.versao;
  } catch {
    return null;
  }

  const usuario = await prisma.usuarios.findUnique({
    where: {
      id_usuario: idUsuario,
    },
    select: {
      id_usuario: true,
      nome_usuario: true,
      email: true,
      permissao_usuario: true,
      foto_perfil: true,
      versao_sessao: true,
      ativo: true,
    },
  });

  if (
    !usuario ||
    !usuario.ativo ||
    usuario.versao_sessao !== versaoSessao
  ) {
    return null;
  }

  return {
    id_usuario: usuario.id_usuario,
    nome_usuario: usuario.nome_usuario,
    email: usuario.email,
    permissao_usuario: usuario.permissao_usuario,
    foto_perfil: usuario.foto_perfil,
  };
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
      "Somente o proprietário pode realizar esta operação.",
      403,
    );
  }

  return usuario;
}