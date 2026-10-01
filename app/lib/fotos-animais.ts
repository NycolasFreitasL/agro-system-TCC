import { randomUUID } from "node:crypto";
import {
  v2 as cloudinary,
  type UploadApiResponse,
} from "cloudinary";

export class ErroFoto extends Error {
  constructor(
    mensagem: string,
    public status = 400,
  ) {
    super(mensagem);
  }
}

function configurarCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new ErroFoto(
      "O armazenamento das fotos ainda não está configurado.",
      503,
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export async function removerFotoAnimal(publicId: string) {
  configurarCloudinary();

  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
}

export async function enviarFotoAnimal(arquivo: File) {
  const limite = 2 * 1024 * 1024;

  if (arquivo.size === 0 || arquivo.size > limite) {
    throw new ErroFoto(
      "Selecione uma foto de até 2 MB.",
    );
  }

  if (
    !["image/jpeg", "image/png", "image/webp"].includes(
      arquivo.type,
    )
  ) {
    throw new ErroFoto(
      "A foto deve estar em JPG, PNG ou WebP.",
    );
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  // Confere a assinatura do arquivo, além do tipo informado.
  const jpeg =
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const png = buffer.subarray(0, 8).equals(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );

  const webp =
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  const formatoCorreto =
    (arquivo.type === "image/jpeg" && jpeg) ||
    (arquivo.type === "image/png" && png) ||
    (arquivo.type === "image/webp" && webp);

  if (!formatoCorreto) {
    throw new ErroFoto(
      "O conteúdo do arquivo não corresponde a uma foto JPG, PNG ou WebP.",
    );
  }

  configurarCloudinary();

  let resultado: UploadApiResponse;

  try {
    resultado = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        const envio = cloudinary.uploader.upload_stream(
          {
            resource_type: "image",
            public_id: `agrosystem/animais/${randomUUID()}`,
            overwrite: false,
            allowed_formats: ["jpg", "png", "webp"],
            transformation: [
              {
                width: 1200,
                height: 1200,
                crop: "limit",
              },
            ],
          },
          (error, result) => {
            if (error || !result) {
              reject(new Error("FALHA_ENVIO_FOTO"));
              return;
            }

            resolve(result);
          },
        );

        envio.on("error", reject);
        envio.end(buffer);
      },
    );
  } catch {
    throw new ErroFoto(
      "Não foi possível enviar a foto. Confira a imagem e a configuração do Cloudinary.",
      502,
    );
  }

  const url = resultado.secure_url;

  // foto_animal é VARCHAR(255) no banco.
  if (!url || url.length > 255) {
    await removerFotoAnimal(resultado.public_id).catch(() => {
      console.error(
        "Não foi possível remover uma foto com endereço inválido.",
      );
    });

    throw new ErroFoto(
      "O endereço gerado para a foto excedeu o limite permitido.",
      502,
    );
  }

  return {
    url,
    publicId: resultado.public_id,
  };
}