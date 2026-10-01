import { prisma } from "@/app/lib/prisma";

import {
  exigirUsuario,
  ErroAutenticacao,
} from "@/app/lib/sessao";

import {
  enviarFotoAnimal,
  removerFotoAnimal,
  ErroFoto,
} from "@/app/lib/fotos-animais";

export const runtime = "nodejs";

class ErroValidacao extends Error {}

const CONDICOES_SAUDE = [
  "SAUDÁVEL",
  "EM OBSERVAÇÃO",
  "EM TRATAMENTO",
];

function hojeEmSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const parte = (tipo: string) =>
    partes.find((item) => item.type === tipo)!.value;

  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

function lerNascimento(valor: unknown): Date | null {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  if (
    typeof valor !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
    valor.startsWith("0000-")
  ) {
    throw new ErroValidacao(
      "Informe uma data de nascimento válida.",
    );
  }

  const data = new Date(`${valor}T12:00:00.000Z`);

  if (
    Number.isNaN(data.getTime()) ||
    data.toISOString().slice(0, 10) !== valor
  ) {
    throw new ErroValidacao(
      "Informe uma data de nascimento válida.",
    );
  }

  if (valor > hojeEmSaoPaulo()) {
    throw new ErroValidacao(
      "A data de nascimento não pode estar no futuro.",
    );
  }

  return data;
}

function lerPeso(valor: unknown): string | null {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  if (
    typeof valor !== "string" &&
    typeof valor !== "number"
  ) {
    throw new ErroValidacao("Informe um peso válido.");
  }

  const texto = String(valor).trim();

  if (!/^\d{1,4}(\.\d{1,2})?$/.test(texto)) {
    throw new ErroValidacao(
      "O peso deve ter até duas casas decimais e não pode ultrapassar 9.999,99 kg.",
    );
  }

  if (Number(texto) <= 0) {
    throw new ErroValidacao(
      "O peso deve ser maior que zero. Se não souber, deixe o campo vazio.",
    );
  }

  return texto;
}

async function lerRequisicao(
  request: Request,
): Promise<{
  dados: Record<string, unknown>;
  foto: File | null;
}> {
  const tipo =
    request.headers.get("content-type") || "";

  if (tipo.includes("multipart/form-data")) {
    const formulario = await request.formData().catch(() => {
      throw new ErroValidacao(
        "Não foi possível ler o formulário enviado.",
      );
    });

    const arquivo = formulario.get("foto");

    if (
      arquivo !== null &&
      !(arquivo instanceof File)
    ) {
      throw new ErroValidacao(
        "Envie a foto como um arquivo.",
      );
    }

    return {
      dados: {
        nome: formulario.get("nome"),
        especie: formulario.get("especie"),
        raca: formulario.get("raca"),
        sexo: formulario.get("sexo"),
        nascimento: formulario.get("nascimento"),
        peso: formulario.get("peso"),
        saude: formulario.get("saude"),
      },
      foto:
        arquivo instanceof File && arquivo.size > 0
          ? arquivo
          : null,
    };
  }

  if (tipo.includes("application/json")) {
    const dados = await request.json().catch(() => {
      throw new ErroValidacao(
        "Os dados enviados são inválidos.",
      );
    });

    if (
      !dados ||
      typeof dados !== "object" ||
      Array.isArray(dados)
    ) {
      throw new ErroValidacao(
        "Os dados enviados são inválidos.",
      );
    }

    return {
      dados,
      foto: null,
    };
  }

  throw new ErroValidacao(
    "O formato dos dados enviados é inválido.",
  );
}

export async function POST(request: Request) {
  let fotoEnviada: {
    url: string;
    publicId: string;
  } | null = null;

  let animalSalvo = false;

  try {
    // Exige login antes de processar dados ou enviar fotos.
    await exigirUsuario();

    const { dados, foto } = await lerRequisicao(request);

    const nome =
      typeof dados.nome === "string"
        ? dados.nome.trim()
        : "";

    if (!nome || nome.length > 100) {
      throw new ErroValidacao(
        "Informe um nome com até 100 caracteres.",
      );
    }

    if (
      typeof dados.especie !== "string" &&
      typeof dados.especie !== "number"
    ) {
      throw new ErroValidacao(
        "Selecione uma espécie válida.",
      );
    }

    const idEspecie = Number(dados.especie);

    if (
      !Number.isSafeInteger(idEspecie) ||
      idEspecie <= 0
    ) {
      throw new ErroValidacao(
        "Selecione uma espécie válida.",
      );
    }

    const sexo = dados.sexo;

    if (sexo !== "M" && sexo !== "F") {
      throw new ErroValidacao(
        "Selecione Macho ou Fêmea.",
      );
    }

    if (
      dados.raca !== undefined &&
      dados.raca !== null &&
      typeof dados.raca !== "string"
    ) {
      throw new ErroValidacao(
        "Informe uma raça válida.",
      );
    }

    const raca =
      typeof dados.raca === "string"
        ? dados.raca.trim()
        : "";

    if (raca.length > 60) {
      throw new ErroValidacao(
        "A raça deve ter no máximo 60 caracteres.",
      );
    }

    const nascimento = lerNascimento(dados.nascimento);
    const peso = lerPeso(dados.peso);

    const saude =
      dados.saude === undefined ||
      dados.saude === null ||
      dados.saude === ""
        ? "SAUDÁVEL"
        : dados.saude;

    if (
      typeof saude !== "string" ||
      !CONDICOES_SAUDE.includes(saude)
    ) {
      throw new ErroValidacao(
        "Selecione uma condição de saúde válida.",
      );
    }

    const especie = await prisma.especie.findUnique({
      where: {
        id_especie: idEspecie,
      },
      select: {
        status: true,
      },
    });

    if (!especie || especie.status !== "ATIVO") {
      throw new ErroValidacao(
        "A espécie selecionada não existe ou está inativa.",
      );
    }

    if (foto) {
      fotoEnviada = await enviarFotoAnimal(foto);
    }

    const animal = await prisma.animal.create({
      data: {
        nome_animal: nome,
        id_especie: idEspecie,
        raca_animal: raca || null,
        sexo_animal: sexo,
        data_nascimento: nascimento,
        peso_animal: peso,
        saude_animal: saude,
        foto_animal: fotoEnviada?.url ?? null,
        status_animal: "ATIVO",
      },
      include: {
        especie: true,
      },
    });

    animalSalvo = true;

    return Response.json(
      {
        message: "Animal cadastrado com sucesso.",
        animal,
      },
      { status: 201 },
    );
  } catch (error) {
    // Se o cadastro falhar, tenta remover a foto já enviada.
    if (fotoEnviada && !animalSalvo) {
      const publicId = fotoEnviada.publicId;

      await removerFotoAnimal(publicId).catch(() => {
        console.error(
          "Falha ao remover foto de cadastro não concluído:",
          publicId,
        );
      });
    }

    if (error instanceof ErroAutenticacao) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof ErroValidacao) {
      return Response.json(
        { error: error.message },
        { status: 400 },
      );
    }

    if (error instanceof ErroFoto) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Erro ao cadastrar animal:", error);

    return Response.json(
      {
        error: "Não foi possível cadastrar o animal.",
      },
      { status: 500 },
    );
  }
}