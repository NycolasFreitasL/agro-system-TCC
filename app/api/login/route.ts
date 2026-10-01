import { prisma } from "@/app/lib/prisma";
import { criarSessao } from "@/app/lib/sessao";
import bcrypt from "bcrypt";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const dados = await request.json().catch(() => null);

    if (
      !dados ||
      typeof dados !== "object" ||
      Array.isArray(dados)
    ) {
      return Response.json(
        { error: "Os dados enviados são inválidos." },
        { status: 400 },
      );
    }

    const email =
      typeof dados.email === "string"
        ? dados.email.trim()
        : "";

    const password =
      typeof dados.password === "string"
        ? dados.password
        : "";

    if (!email || !password) {
      return Response.json(
        { error: "E-mail e senha são obrigatórios." },
        { status: 400 },
      );
    }

    if (email.length > 150 || password.length > 250) {
      return Response.json(
        { error: "E-mail ou senha inválidos." },
        { status: 400 },
      );
    }

    const usuario = await prisma.usuarios.findUnique({
      where: {
        email,
      },
      select: {
        id_usuario: true,
        senha: true,
      },
    });

    // A resposta não revela se o e-mail está cadastrado.
    if (!usuario) {
      return Response.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 },
      );
    }

    const senhaCorreta = await bcrypt.compare(
      password,
      usuario.senha,
    );

    if (!senhaCorreta) {
      return Response.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 },
      );
    }

    await criarSessao(usuario.id_usuario);

    return Response.json(
      { message: "Login bem-sucedido." },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Erro ao realizar login:", error);

    return Response.json(
      { error: "Não foi possível entrar. Tente novamente." },
      { status: 500 },
    );
  }
}