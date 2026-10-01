import bcrypt from "bcrypt";
import { prisma } from "@/app/lib/prisma";
import {
  criarSessao,
  ErroAutenticacao,
} from "@/app/lib/sessao";

export const runtime = "nodejs";

function responderErro(mensagem: string, status: number) {
  return Response.json(
    { error: mensagem },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  try {
    const dados = await request.json().catch(() => null);

    if (
      !dados ||
      typeof dados !== "object" ||
      Array.isArray(dados)
    ) {
      return responderErro("Os dados enviados são inválidos.", 400);
    }

    const email =
      typeof dados.email === "string"
        ? dados.email.trim().toLowerCase()
        : "";

    // Mantém "password", utilizado pelo formulário de login.
    const password =
      typeof dados.password === "string"
        ? dados.password
        : "";

    if (!email || !password) {
      return responderErro("E-mail e senha são obrigatórios.", 400);
    }

    if (
      email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return responderErro("E-mail ou senha inválidos.", 400);
    }

    // Aceita e-mails antigos com letras maiúsculas.
    // Se houver duplicidade por diferença de maiúsculas,
    // não escolhe uma conta arbitrariamente.
    const encontrados = await prisma.usuarios.findMany({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: {
        id_usuario: true,
        senha: true,
        ativo: true,
        versao_sessao: true,
      },
      take: 2,
    });

    if (encontrados.length !== 1) {
      return responderErro(
        "E-mail ou senha incorretos, ou acesso indisponível.",
        401,
      );
    }

    const usuario = encontrados[0];

    if (!usuario.ativo) {
      return responderErro(
        "E-mail ou senha incorretos, ou acesso indisponível.",
        401,
      );
    }

    const senhaCorreta = await bcrypt.compare(
      password,
      usuario.senha,
    );

    if (!senhaCorreta) {
      return responderErro(
        "E-mail ou senha incorretos, ou acesso indisponível.",
        401,
      );
    }

    await criarSessao(
      usuario.id_usuario,
      usuario.versao_sessao,
    );

    return Response.json(
      { message: "Login bem-sucedido." },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof ErroAutenticacao) {
      return responderErro(error.message, error.status);
    }

    console.error("Erro ao realizar login:", error);

    return responderErro(
      "Não foi possível entrar. Tente novamente.",
      500,
    );
  }
}