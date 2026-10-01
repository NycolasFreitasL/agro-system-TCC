import bcrypt from "bcrypt";
import { prisma } from "@/app/lib/prisma";
import {
  ErroAutenticacao,
  exigirProprietario,
} from "@/app/lib/sessao";

export const runtime = "nodejs";

class ErroValidacao extends Error {
  constructor(
    mensagem: string,
    public status = 400,
  ) {
    super(mensagem);
  }
}

async function lerDados(request: Request) {
  const dados = await request.json().catch(() => null);

  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados)
  ) {
    throw new ErroValidacao("Os dados enviados são inválidos.");
  }

  return dados;
}

function responderErro(error: unknown) {
  if (
    error instanceof ErroValidacao ||
    error instanceof ErroAutenticacao
  ) {
    return Response.json(
      { error: error.message },
      { status: error.status },
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return Response.json(
      { error: "Já existe um usuário com esse e-mail." },
      { status: 409 },
    );
  }

  console.error("Erro na administração de usuários:", error);

  return Response.json(
    { error: "Não foi possível concluir a operação." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    await exigirProprietario();

    const dados = await lerDados(request);

    const nome =
      typeof dados.nome === "string"
        ? dados.nome.trim()
        : "";

    const email =
      typeof dados.email === "string"
        ? dados.email.trim().toLowerCase()
        : "";

    const senha =
      typeof dados.senha === "string"
        ? dados.senha
        : "";

    if (!nome || nome.length > 100) {
      throw new ErroValidacao(
        "O nome deve ter entre 1 e 100 caracteres.",
      );
    }

    if (
      email.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new ErroValidacao("Informe um e-mail válido.");
    }

    if (
      senha.length < 12 ||
      Buffer.byteLength(senha, "utf8") > 72
    ) {
      throw new ErroValidacao(
        "A senha deve ter pelo menos 12 caracteres e no máximo 72 bytes.",
      );
    }

    if (senha !== dados.confirmacaoSenha) {
      throw new ErroValidacao(
        "A confirmação da senha não confere.",
      );
    }

    const hash = await bcrypt.hash(senha, 12);

    await prisma.$transaction(async (tx) => {
      // Serializa os cadastros realizados por esta API.
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(73142, 4)::text AS bloqueio
      `;

      const existente = await tx.usuarios.findFirst({
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

      if (existente) {
        throw new ErroValidacao(
          "Já existe um usuário com esse e-mail.",
          409,
        );
      }

      await tx.usuarios.create({
        data: {
          nome_usuario: nome,
          email,
          senha: hash,

          // A permissão é definida no servidor.
          // O formulário não pode criar proprietários.
          permissao_usuario: "FUNCIONARIO",
          ativo: true,
          versao_sessao: 0,
        },
      });
    });

    return Response.json(
      { message: "Funcionário cadastrado com sucesso." },
      { status: 201 },
    );
  } catch (error) {
    return responderErro(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const proprietario = await exigirProprietario();
    const dados = await lerDados(request);

    if (
      typeof dados.idUsuario !== "number" ||
      !Number.isSafeInteger(dados.idUsuario) ||
      dados.idUsuario <= 0
    ) {
      throw new ErroValidacao("Selecione um usuário válido.");
    }

    if (typeof dados.ativo !== "boolean") {
      throw new ErroValidacao("Informe uma situação válida.");
    }

    const idUsuario = dados.idUsuario;
    const ativo = dados.ativo;

    if (idUsuario === proprietario.id_usuario) {
      throw new ErroValidacao(
        "Você não pode alterar seu próprio acesso por esta tela.",
        403,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id_usuario
        FROM usuarios
        WHERE id_usuario = ${idUsuario}
        FOR UPDATE
      `;

      const usuario = await tx.usuarios.findUnique({
        where: {
          id_usuario: idUsuario,
        },
        select: {
          id_usuario: true,
          permissao_usuario: true,
          ativo: true,
        },
      });

      if (!usuario) {
        throw new ErroValidacao("Usuário não encontrado.", 404);
      }

      if (usuario.permissao_usuario !== "FUNCIONARIO") {
        throw new ErroValidacao(
          "Esta operação está disponível apenas para funcionários.",
          403,
        );
      }

      if (usuario.ativo === ativo) {
        return;
      }

      await tx.usuarios.update({
        where: {
          id_usuario: idUsuario,
        },
        data: {
          ativo,
          atualizado_em: new Date(),

          // Sessões anteriores não voltam a funcionar
          // quando o funcionário é reativado.
          versao_sessao: {
            increment: 1,
          },
        },
      });
    });

    return Response.json({
      message: ativo
        ? "Acesso reativado. O funcionário pode entrar novamente."
        : "Acesso desativado. As sessões anteriores foram invalidadas.",
    });
  } catch (error) {
    return responderErro(error);
  }
}