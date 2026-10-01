import { randomUUID } from "node:crypto";
import {
  v2 as cloudinary,
  type UploadApiResponse,
} from "cloudinary";

import { prisma } from "@/app/lib/prisma";
import {
  ErroAutenticacao,
  exigirUsuario,
} from "@/app/lib/sessao";

export const runtime = "nodejs";

const LIMITE = 4 * 1024 * 1024;

class ErroFoto extends Error {
  constructor(
    mensagem: string,
    public status = 400,
  ) {
    super(mensagem);
  }
}

export async function POST(request: Request) {
  let imagemEnviada: string | null = null;

  try {
    const usuario = await exigirUsuario();

    const formulario = await request.formData().catch(() => {
      throw new ErroFoto("Não foi possível ler o arquivo enviado.");
    });

    const foto = formulario.get("foto");

    if (!(foto instanceof File) || foto.size === 0) {
      throw new ErroFoto("Selecione uma foto.");
    }

    if (foto.size > LIMITE) {
      throw new ErroFoto("A foto deve ter no máximo 4 MB.");
    }

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(foto.type)
    ) {
      throw new ErroFoto("Envie uma imagem JPG, PNG ou WebP.");
    }

    const buffer = Buffer.from(await foto.arrayBuffer());

    const jpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    const png =
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );

    const webp =
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP";

    const formatoValido =
      (foto.type === "image/jpeg" && jpeg) ||
      (foto.type === "image/png" && png) ||
      (foto.type === "image/webp" && webp);

    if (!formatoValido) {
      throw new ErroFoto("O conteúdo do arquivo não é uma imagem válida.");
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ErroFoto(
        "O serviço de fotos não está configurado.",
        503,
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    const resultado = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        const envio = cloudinary.uploader.upload_stream(
          {
            resource_type: "image",
            public_id:
              `agrosystem/perfis/${usuario.id_usuario}/` +
              randomUUID(),
            overwrite: false,
            allowed_formats: ["jpg", "png", "webp"],
            transformation: [
              {
                width: 800,
                height: 800,
                crop: "limit",
              },
            ],
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            if (!result) {
              reject(new Error("O serviço não retornou a imagem."));
              return;
            }

            resolve(result);
          },
        );

        envio.on("error", reject);
        envio.end(buffer);
      },
    );

    imagemEnviada = resultado.public_id;

    if (
      !resultado.secure_url ||
      !resultado.secure_url.startsWith("https://") ||
      resultado.secure_url.length > 255
    ) {
      throw new ErroFoto(
        "Não foi possível gerar um endereço válido para a foto.",
        502,
      );
    }

    // Impede que dois envios simultâneos substituam a mesma
    // foto sem perceber que outro envio já foi salvo.
    const atualizacao = await prisma.usuarios.updateMany({
      where: {
        id_usuario: usuario.id_usuario,
        foto_perfil: usuario.foto_perfil,
      },
      data: {
        foto_perfil: resultado.secure_url,
        atualizado_em: new Date(),
      },
    });

    if (atualizacao.count !== 1) {
      throw new ErroFoto(
        "O perfil foi alterado durante o envio. Atualize a página e tente novamente.",
        409,
      );
    }

    // A imagem já está vinculada ao usuário.
    imagemEnviada = null;

    return Response.json(
      {
        message: "Foto atualizada com sucesso.",
        foto: resultado.secure_url,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    // Remove o novo upload se ele não pôde ser salvo no banco.
    if (imagemEnviada) {
      try {
        await cloudinary.uploader.destroy(imagemEnviada, {
          resource_type: "image",
          invalidate: true,
        });
      } catch {
        console.error(
          "Não foi possível remover um upload de perfil não utilizado:",
          imagemEnviada,
        );
      }
    }

    if (
      error instanceof ErroAutenticacao ||
      error instanceof ErroFoto
    ) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Erro ao atualizar foto do perfil:", error);

    return Response.json(
      { error: "Não foi possível salvar a foto. Tente novamente." },
      { status: 500 },
    );
  }
}