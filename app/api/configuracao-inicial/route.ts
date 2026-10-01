import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

class ErroCadastro extends Error {
  constructor(
    mensagem: string,
    public status = 400,
  ) {
    super(mensagem);
  }
}

function validarChave(valor: unknown) {
  const segredo = process.env.SETUP_SECRET;

  if (!segredo || segredo.length < 64) {
    throw new ErroCadastro("O cadastro inicial está desabilitado.", 403);
  }

  if (typeof valor !== "string") {
    throw new ErroCadastro("Chave de configuração inválida.", 403);
  }

  const recebida = Buffer.from(valor, "utf8");
  const esperada = Buffer.from(segredo, "utf8");

  if (
    recebida.length !== esperada.length ||
    !timingSafeEqual(recebida, esperada)
  ) {
    throw new ErroCadastro("Chave de configuração inválida.", 403);
  }
}

export async function POST(request: Request) {
  try {
    const dados = await request.json().catch(() => null);

    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroCadastro("Os dados enviados são inválidos.");
    }

    // A chave é validada antes de consultar ou alterar usuários.
    validarChave(dados.chave);

    const nome = typeof dados.nome === "string" ? dados.nome.trim() : "";

    const email =
      typeof dados.email === "string" ? dados.email.trim().toLowerCase() : "";

    const senha = typeof dados.senha === "string" ? dados.senha : "";

    if (!nome || nome.length > 100) {
      throw new ErroCadastro("Informe um nome com até 100 caracteres.");
    }

    if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ErroCadastro("Informe um e-mail válido.");
    }

    if (senha.length < 12) {
      throw new ErroCadastro("Use uma senha com pelo menos 12 caracteres.");
    }

    // bcrypt considera no máximo 72 bytes da senha.
    if (Buffer.byteLength(senha, "utf8") > 72) {
      throw new ErroCadastro("A senha é muito longa. Use uma senha menor.");
    }

    if (dados.confirmacao !== senha) {
      throw new ErroCadastro("A confirmação da senha não confere.");
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    await prisma.$transaction(async (tx) => {
      // Serializa os cadastros iniciais para impedir dois
      // proprietários criados simultaneamente por esta rota.
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(73142, 1)::text AS bloqueio
    `;

      const proprietario = await tx.usuarios.findFirst({
        where: {
          permissao_usuario: {
            equals: "PROPRIETARIO",
            mode: "insensitive",
          },
        },
        select: {
          id_usuario: true,
        },
      });

      if (proprietario) {
        throw new ErroCadastro(
          "O proprietário já foi cadastrado. Entre com sua conta.",
          409,
        );
      }

      const usuarioExistente = await tx.usuarios.findFirst({
        where: {
          email: {
            equals: email,
            mode: "insensitive",
          },
        },
        select: {
          id_usuario: true,
        },
      });

      if (usuarioExistente) {
        throw new ErroCadastro(
          "Este e-mail já está cadastrado. Use outro e-mail para a nova conta.",
          409,
        );
      }

      await tx.usuarios.create({
        data: {
          nome_usuario: nome,
          email,
          senha: senhaHash,
          permissao_usuario: "PROPRIETARIO",
        },
      });
    });

    return Response.json(
      {
        message: "Proprietário cadastrado. Agora entre pela página de login.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ErroCadastro) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "Este e-mail já está cadastrado." },
        { status: 409 },
      );
    }

    console.error("Erro no cadastro inicial:", error);

    return Response.json(
      { error: "Não foi possível cadastrar o proprietário." },
      { status: 500 },
    );
  }
}
