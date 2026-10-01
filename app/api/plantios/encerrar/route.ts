import { prisma } from "@/app/lib/prisma";
import { exigirUsuario, ErroAutenticacao } from "@/app/lib/sessao";
import { modalidadeEncerramento, motivoValido, nomeModalidade } from "@/app/lib/encerramento-cultivo";

class ErroValidacao extends Error {
  constructor(mensagem: string, public status = 400) { super(mensagem); }
}

export async function POST(request: Request) {
  try {
    const usuario = await exigirUsuario();
    const dados = await request.json().catch(() => null);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      throw new ErroValidacao("Os dados enviados são inválidos.");
    }
    const idPlantio = typeof dados.idPlantio === "number" || typeof dados.idPlantio === "string"
      ? Number(dados.idPlantio) : NaN;
    if (!Number.isSafeInteger(idPlantio) || idPlantio <= 0) {
      throw new ErroValidacao("Informe um plantio válido.");
    }
    const tipo = dados.tipoEncerramento;
    if (tipo !== "NORMAL" && tipo !== "PERDA") {
      throw new ErroValidacao("Selecione encerramento normal ou por perda.");
    }
    const motivo = typeof dados.motivo === "string" ? dados.motivo.trim() : "";
    if (!motivoValido(motivo)) {
      throw new ErroValidacao("Informe um motivo com 5 a 1000 caracteres.");
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // Consulta só para localizar o lote; os dados são revalidados sob bloqueio.
      const referencia = await tx.plantio.findUnique({
        where: { id_plantio: idPlantio }, select: { id_lote: true },
      });
      if (!referencia) throw new ErroValidacao("Plantio não encontrado.", 404);

      // Ordem compartilhada com a ocupação/administração de lotes: lote → plantio.
      await tx.$queryRaw`
        SELECT id_lote FROM public.lote WHERE id_lote = ${referencia.id_lote} FOR UPDATE
      `;
      // A colheita bloqueia este mesmo plantio e não adquire lote depois dele.
      await tx.$queryRaw`
        SELECT id_plantio FROM public.plantio WHERE id_plantio = ${idPlantio} FOR UPDATE
      `;
      const plantio = await tx.plantio.findUnique({ where: { id_plantio: idPlantio } });
      if (!plantio) throw new ErroValidacao("Plantio não encontrado.", 404);
      if (plantio.id_lote !== referencia.id_lote) {
        throw new ErroValidacao("O lote do plantio mudou. Atualize a página e tente novamente.", 409);
      }

      const anterior = await tx.evento_plantio.findFirst({
        where: { id_plantio: idPlantio, tipo: "ENCERRAMENTO" },
        select: { id_evento: true, modalidade: true, motivo: true },
      });
      const concluido = ["CONCLUIDO", "CONCLUÍDO"].includes(plantio.status_plantio);
      if (anterior) {
        const mesmoTipo = tipo === "NORMAL" ? anterior.modalidade === "NORMAL"
          : ["PERDA_TOTAL", "PERDA_REMANESCENTE"].includes(anterior.modalidade ?? "");
        if (!concluido || !mesmoTipo || anterior.motivo !== motivo) {
          throw new ErroValidacao("O cultivo já possui um encerramento diferente. Confira o histórico; modalidade e motivo não podem ser substituídos.", 409);
        }
        return { idEvento: anterior.id_evento, modalidade: anterior.modalidade, repetido: true };
      }
      if (concluido) {
        throw new ErroValidacao("Este cultivo já foi encerrado sem evento de encerramento. Os dados antigos foram preservados; não é possível atribuir motivo ou responsável retroativamente.", 409);
      }
      if (!["ATIVO", "EM ANDAMENTO"].includes(plantio.status_plantio)) {
        throw new ErroValidacao("Somente plantios ativos podem ser encerrados.", 409);
      }
      const colheitas = await tx.colheita.count({ where: { id_plantio: idPlantio } });
      if (tipo === "NORMAL" && colheitas === 0) {
        throw new ErroValidacao("Registre a colheita antes do encerramento normal. Em caso de perda, selecione encerramento por perda.");
      }
      const modalidade = modalidadeEncerramento(tipo, colheitas);
      const antes = {
        id_plantio: plantio.id_plantio, id_lote: plantio.id_lote,
        id_produto: plantio.id_produto, id_cultura: plantio.id_cultura,
        area_plantada: plantio.area_plantada?.toString() ?? null,
        quantidade_plantada: plantio.quantidade_plantada.toString(),
        unidade_plantada: plantio.unidade_plantada, id_usuario: plantio.id_usuario,
        data_plantio: plantio.data_plantio.toISOString().slice(0, 10),
        status_plantio: plantio.status_plantio, quantidade_colheitas: colheitas,
      };
      // Apenas status e evento: sementes, colheitas e movimentos são preservados.
      await tx.plantio.update({ where: { id_plantio: idPlantio }, data: { status_plantio: "CONCLUIDO" } });
      const evento = await tx.evento_plantio.create({
        data: {
          id_plantio: idPlantio, tipo: "ENCERRAMENTO", modalidade, motivo,
          id_usuario: usuario.id_usuario, antes, depois: { ...antes, status_plantio: "CONCLUIDO" },
          // registrado_em usa clock_timestamp() no banco aplicado.
        },
        select: { id_evento: true },
      });
      return { idEvento: evento.id_evento, modalidade, repetido: false };
    }, { isolationLevel: "ReadCommitted" });

    return Response.json({
      ...resultado,
      message: resultado.repetido ? "Este encerramento já foi registrado. Confira o histórico."
        : `${nomeModalidade(resultado.modalidade)} registrado. A área foi liberada.`,
    });
  } catch (error) {
    if (error instanceof ErroAutenticacao || error instanceof ErroValidacao) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    // O índice parcial é também uma proteção contra escritas fora deste fluxo.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return Response.json({ error: "Conflito ao registrar o encerramento. Confira o evento existente no histórico antes de tentar novamente." }, { status: 409 });
    }
    console.error("Erro ao encerrar cultivo:", error);
    return Response.json({ error: "Não foi possível encerrar o cultivo. Confira o histórico antes de tentar novamente." }, { status: 500 });
  }
}
