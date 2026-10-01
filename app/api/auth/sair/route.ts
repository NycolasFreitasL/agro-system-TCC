import { encerrarSessao } from "@/app/lib/sessao";

export async function POST() {
  try {
    // Também permite sair quando a sessão já expirou.
    await encerrarSessao();

    return Response.json(
      { message: "Sessão encerrada." },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Erro ao encerrar sessão:", error);

    return Response.json(
      { error: "Não foi possível sair. Tente novamente." },
      { status: 500 },
    );
  }
}