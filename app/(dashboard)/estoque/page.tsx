import { prisma } from "@/app/lib/prisma";
import ProdutoModal from "@/app/components/produtomodal";
import MovimentacaoModal from "@/app/components/movimentacaomodal";

type Situacao = "NORMAL" | "BAIXO" | "SEM_ESTOQUE";

function obterSituacao(
  quantidade: number,
  estoqueMinimo: number,
): Situacao {
  if (quantidade <= 0) {
    return "SEM_ESTOQUE";
  }

  if (quantidade < estoqueMinimo) {
    return "BAIXO";
  }

  return "NORMAL";
}

function formatarQuantidade(valor: number) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarUnidade(unidade: string) {
  const unidades: Record<string, string> = {
    KG: "kg",
    G: "g",
    L: "L",
    ML: "mL",
    UNIDADE: "un.",
    SACA: "saca",
    DOSE: "dose",
    MUDA: "muda",
    TONELADA: "t",
  };

  return unidades[unidade.trim().toUpperCase()] ?? unidade;
}

function formatarData(data: Date) {
  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export default async function EstoquePage() {
  const [produtosBanco, movimentacoes] = await Promise.all([
    prisma.produto.findMany({
      include: {
        cultura: {
          select: {
            nome_cultura: true,
          },
        },
      },
      orderBy: {
        nome_produto: "asc",
      },
    }),

    prisma.move_estoque.findMany({
      take: 10,
      orderBy: [
        {
          data_movimentacao: "desc",
        },
        {
          id_movimentacao: "desc",
        },
      ],
      include: {
        produto: true,
        usuarios: true,
      },
    }),
  ]);

  const produtos = produtosBanco.map((produto) => {
    const quantidade = Number(produto.quantidade);
    const estoqueMinimo = Number(produto.estoque_min);

    // Compatibilidade com o cadastro e a API de colheitas:
    // Outro + cultura vinculada + KG identifica produto colhido.
    const produtoColhido =
      produto.categoria === "Outro" &&
      produto.id_cultura !== null &&
      produto.unidade_medida.trim().toUpperCase() === "KG";

    return {
      ...produto,
      quantidadeNumero: quantidade,
      estoqueMinimoNumero: estoqueMinimo,
      categoriaExibida: produtoColhido
        ? "Produto colhido"
        : produto.categoria,
      situacao: obterSituacao(quantidade, estoqueMinimo),
    };
  });

  const totalNormal = produtos.filter(
    (produto) => produto.situacao === "NORMAL",
  ).length;

  const totalBaixo = produtos.filter(
    (produto) => produto.situacao === "BAIXO",
  ).length;

  const totalSemEstoque = produtos.filter(
    (produto) => produto.situacao === "SEM_ESTOQUE",
  ).length;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px]">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
            Suprimentos
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Controle de estoque
          </h1>

          <p className="mt-2 text-slate-500">
            Acompanhe produtos, disponibilidade e movimentações.
          </p>
        </div>

        <div className="shrink-0">
          <ProdutoModal />
        </div>
      </header>

      <section
        aria-label="Resumo do estoque"
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Card
          titulo="Produtos cadastrados"
          valor={produtos.length}
          descricao="Itens diferentes no estoque"
          icone="📦"
        />

        <Card
          titulo="Estoque normal"
          valor={totalNormal}
          descricao="Saldo positivo igual ou superior ao mínimo"
          icone="✅"
        />

        <Card
          titulo="Estoque baixo"
          valor={totalBaixo}
          descricao="Saldo positivo abaixo do mínimo"
          icone="⚠️"
          tom="amarelo"
        />

        <Card
          titulo="Sem estoque"
          valor={totalSemEstoque}
          descricao="Produtos sem saldo disponível"
          icone="📭"
          tom="vermelho"
        />
      </section>

      {(totalBaixo > 0 || totalSemEstoque > 0) && (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-900">
            Atenção ao estoque
          </h2>

          <p className="mt-1 text-sm text-amber-800">
            {totalSemEstoque} produto(s) sem estoque e{" "}
            {totalBaixo} com saldo positivo abaixo do mínimo.
            Confira a necessidade de reposição.
          </p>
        </section>
      )}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">
            Produtos armazenados
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {produtos.length} registros encontrados
          </p>
        </div>

        {produtos.length === 0 ? (
          <div className="p-10 text-center">
            <div aria-hidden="true" className="text-5xl">
              📦
            </div>

            <h3 className="mt-4 font-bold text-slate-800">
              Nenhum produto cadastrado
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Use “Novo produto” para adicionar o primeiro item.
            </p>
          </div>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="hidden gap-4 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500 xl:grid xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_minmax(0,1.2fr)]"
            >
              <span>Produto</span>
              <span>Categoria</span>
              <span>Quantidade</span>
              <span>Estoque mínimo</span>
              <span>Situação</span>
              <span>Ações</span>
            </div>

            <ul className="divide-y divide-slate-100">
              {produtos.map((produto) => (
                <li
                  key={produto.id_produto}
                  className="grid min-w-0 grid-cols-2 items-start gap-4 p-5 transition hover:bg-slate-50 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_minmax(0,1.2fr)] xl:items-center"
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-3 xl:col-span-1">
                    <div
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100"
                    >
                      📦
                    </div>

                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-slate-800">
                        {produto.nome_produto}
                      </h3>

                      <p className="mt-1 text-xs text-slate-400">
                        Código #{produto.id_produto}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <Rotulo texto="Categoria" />

                    <p className="break-words text-sm text-slate-600">
                      {produto.categoriaExibida}
                    </p>

                    {produto.cultura && (
                      <p className="mt-1 break-words text-xs text-green-700">
                        Cultura: {produto.cultura.nome_cultura}
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Rotulo texto="Quantidade" />

                    <p className="break-words text-sm">
                      <strong className="text-slate-800">
                        {formatarQuantidade(
                          produto.quantidadeNumero,
                        )}
                      </strong>{" "}
                      <span className="text-slate-500">
                        {formatarUnidade(produto.unidade_medida)}
                      </span>
                    </p>
                  </div>

                  <div className="min-w-0">
                    <Rotulo texto="Estoque mínimo" />

                    <p className="break-words text-sm text-slate-600">
                      {formatarQuantidade(
                        produto.estoqueMinimoNumero,
                      )}{" "}
                      {formatarUnidade(produto.unidade_medida)}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <Rotulo texto="Situação" />
                    <SituacaoEstoque situacao={produto.situacao} />
                  </div>

                  <div className="col-span-2 min-w-0 border-t border-slate-100 pt-3 text-sm xl:col-span-1 xl:border-0 xl:pt-0">
                    <MovimentacaoModal
                      idProduto={produto.id_produto}
                      nomeProduto={produto.nome_produto}
                      quantidadeAtual={produto.quantidadeNumero}
                      unidadeMedida={produto.unidade_medida}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-8 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">
            Movimentações recentes
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Últimas 10 movimentações registradas
          </p>
        </div>

        {movimentacoes.length === 0 ? (
          <div className="p-10 text-center">
            <div aria-hidden="true" className="text-4xl">
              📋
            </div>

            <p className="mt-3 font-semibold text-slate-700">
              Nenhuma movimentação registrada
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {movimentacoes.map((movimentacao) => {
              const entrada =
                movimentacao.tipo_movimento === "ENTRADA";

              const saida =
                movimentacao.tipo_movimento === "SAIDA" ||
                movimentacao.tipo_movimento === "SAÍDA";

              const cor = entrada
                ? "text-green-700"
                : saida
                  ? "text-red-700"
                  : "text-slate-700";

              const corEtiqueta = entrada
                ? "bg-green-50 text-green-700"
                : saida
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-100 text-slate-700";

              return (
                <li
                  key={movimentacao.id_movimentacao}
                  className="min-w-0 p-5 hover:bg-slate-50"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-slate-800">
                        {movimentacao.produto.nome_produto}
                      </h3>

                      <p className="mt-1 text-xs text-slate-400">
                        Movimentação #{movimentacao.id_movimentacao}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${corEtiqueta}`}
                      >
                        {entrada
                          ? "Entrada"
                          : saida
                            ? "Saída"
                            : movimentacao.tipo_movimento}
                      </span>

                      <strong className={`text-sm ${cor}`}>
                        {entrada ? "+" : saida ? "−" : ""}
                        {formatarQuantidade(
                          Number(movimentacao.quantidade_move),
                        )}{" "}
                        {formatarUnidade(
                          movimentacao.produto.unidade_medida,
                        )}
                      </strong>
                    </div>
                  </div>

                  <dl className="mt-4 grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">
                        Data e horário
                      </dt>

                      <dd className="mt-1 text-slate-700">
                        {formatarData(
                          movimentacao.data_movimentacao,
                        )}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">
                        Responsável
                      </dt>

                      <dd className="mt-1 break-words text-slate-700">
                        {movimentacao.usuarios.nome_usuario}
                      </dd>
                    </div>

                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-xs text-slate-500">
                        Observação
                      </dt>

                      <dd className="mt-1 whitespace-pre-wrap break-words text-slate-600">
                        {movimentacao.observacao || "Sem observação"}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Rotulo({ texto }: { texto: string }) {
  return (
    <p className="mb-1 text-xs font-medium text-slate-500 xl:sr-only">
      {texto}
    </p>
  );
}

function SituacaoEstoque({
  situacao,
}: {
  situacao: Situacao;
}) {
  const configuracao = {
    NORMAL: {
      texto: "Normal",
      classe: "bg-green-50 text-green-700",
    },
    BAIXO: {
      texto: "Estoque baixo",
      classe: "bg-amber-50 text-amber-800",
    },
    SEM_ESTOQUE: {
      texto: "Sem estoque",
      classe: "bg-red-50 text-red-700",
    },
  }[situacao];

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${configuracao.classe}`}
    >
      {configuracao.texto}
    </span>
  );
}

type CardProps = {
  titulo: string;
  valor: number;
  descricao: string;
  icone: string;
  tom?: "verde" | "amarelo" | "vermelho";
};

function Card({
  titulo,
  valor,
  descricao,
  icone,
  tom = "verde",
}: CardProps) {
  const corIcone = {
    verde: "bg-green-100",
    amarelo: "bg-amber-100",
    vermelho: "bg-red-100",
  }[tom];

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm text-slate-500">
            {titulo}
          </h2>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {valor.toLocaleString("pt-BR")}
          </p>
        </div>

        <div
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${corIcone}`}
        >
          {icone}
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {descricao}
      </p>
    </article>
  );
}