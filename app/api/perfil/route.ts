import bcrypt from "bcrypt";
import { prisma } from "@/app/lib/prisma";
import {
  encerrarSessao,
  ErroAutenticacao,
  exigirUsuario,
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

export async function PATCH(request: Request) {
  try {
    const usuarioAtual = await exigirUsuario();

    const dados = await request.json().catch(() => {
      throw new ErroValidacao("Os dados enviados são inválidos.");
    });

    if (
      !dados ||
      typeof dados !== "object" ||
      Array.isArray(dados)
    ) {
      throw new ErroValidacao("Os dados enviados são inválidos.");
    }

    const acao = dados.acao;

    if (acao !== "dados" && acao !== "senha") {
      throw new ErroValidacao("Operação inválida.");
    }

    const senhaAtual =
      typeof dados.senhaAtual === "string"
        ? dados.senhaAtual
        : "";

    if (Buffer.byteLength(senhaAtual, "utf8") > 72) {
      throw new ErroValidacao("A senha atual é inválida.");
    }

    let nome = "";
    let email = "";
    let novaSenha = "";
    let novoHash: string | null = null;

    if (acao === "dados") {
      nome =
        typeof dados.nome === "string"
          ? dados.nome.trim()
          : "";

      email =
        typeof dados.email === "string"
          ? dados.email.trim().toLowerCase()
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
    } else {
      novaSenha =
        typeof dados.novaSenha === "string"
          ? dados.novaSenha
          : "";

      if (!senhaAtual) {
        throw new ErroValidacao("Informe sua senha atual.");
      }

      if (
        novaSenha.length < 12 ||
        Buffer.byteLength(novaSenha, "utf8") > 72
      ) {
        throw new ErroValidacao(
          "A nova senha deve ter pelo menos 12 caracteres e no máximo 72 bytes.",
        );
      }

      if (novaSenha !== dados.confirmacaoSenha) {
        throw new ErroValidacao(
          "A confirmação da nova senha não confere.",
        );
      }

      if (novaSenha === senhaAtual) {
        throw new ErroValidacao(
          "Escolha uma senha diferente da atual.",
        );
      }

      // Calcula o hash antes de bloquear o registro no banco.
      novoHash = await bcrypt.hash(novaSenha, 12);
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id_usuario
          FROM usuarios
          WHERE id_usuario = ${usuarioAtual.id_usuario}
          FOR UPDATE
        `;

        const usuario = await tx.usuarios.findUnique({
          where: {
            id_usuario: usuarioAtual.id_usuario,
          },
        });

        if (!usuario) {
          throw new ErroAutenticacao();
        }

        const alterandoEmail =
          acao === "dados" && email !== usuario.email;

        if (acao === "senha" || alterandoEmail) {
          if (!senhaAtual) {
            throw new ErroValidacao(
              "Informe sua senha atual para confirmar a alteração.",
            );
          }

          const senhaCorreta = await bcrypt.compare(
            senhaAtual,
            usuario.senha,
          );

          if (!senhaCorreta) {
            throw new ErroValidacao(
              "A senha atual está incorreta.",
            );
          }
        }

        if (acao === "senha") {
          if (!novoHash) {
            throw new Error("Hash da nova senha não gerado.");
          }

          await tx.usuarios.update({
            where: {
              id_usuario: usuario.id_usuario,
            },
            data: {
              senha: novoHash,
              versao_sessao: {
                increment: 1,
              },
              atualizado_em: new Date(),
            },
          });

          return;
        }

        const emailExistente = await tx.usuarios.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive",
            },
            id_usuario: {
              not: usuario.id_usuario,
            },
          },
          select: {
            id_usuario: true,
          },
        });

        if (emailExistente) {
          throw new ErroValidacao(
            "Este e-mail já está sendo utilizado.",
            409,
          );
        }

        await tx.usuarios.update({
          where: {
            id_usuario: usuario.id_usuario,
          },
          data: {
            nome_usuario: nome,
            email,
            atualizado_em: new Date(),
          },
        });
      },
      { timeout: 15000 },
    );

    if (acao === "senha") {
      await encerrarSessao();

      return Response.json(
        {
          message: "Senha alterada. Entre novamente.",
          entrarNovamente: true,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return Response.json(
      {
        message: "Perfil atualizado com sucesso.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (
      error instanceof ErroAutenticacao ||
      error instanceof ErroValidacao
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
        { error: "Este e-mail já está sendo utilizado." },
        { status: 409 },
      );
    }

    console.error("Erro ao atualizar perfil:", error);

    return Response.json(
      { error: "Não foi possível atualizar o perfil." },
      { status: 500 },
    );
  }
}