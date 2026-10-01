import { obterUsuarioAtual } from "@/app/lib/sessao";

export async function GET() {
  try {
    const usuario = await obterUsuarioAtual();

    if (!usuario) {
      return Response.json(
        { error: "Você não está autenticado." },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return Response.json(
      { usuario },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Erro ao consultar sessão:", error);

    return Response.json(
      { error: "Não foi possível consultar a sessão." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}