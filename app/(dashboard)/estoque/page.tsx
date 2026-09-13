import { prisma } from "@/app/lib/prisma";
import ProdutoModal from "@/app/components/produtomodal";
import MovimentacaoModal from "@/app/components/movimentacaomodal";

export default async function EstoquePage() {
  const produtos = await prisma.produto.findMany({
    orderBy: {
      nome_produto: "asc",
    },
  });
  const movimentacoes = await prisma.move_estoque.findMany({
    take: 10,

    orderBy: {
      data_movimentacao: "desc",
    },

    include: {
      produto: true,
      usuarios: true,
    },
  });

  const produtosAbaixoMinimo = produtos.filter(
    (produto) => Number(produto.quantidade) <= Number(produto.estoque_min),
  );

  const quantidadeTotal = produtos.reduce(
    (total, produto) => total + Number(produto.quantidade),
    0,
  );

  return (
    <div>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
            Suprimentos
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Controle de estoque
          </h1>

          <p className="mt-2 text-slate-500">
            Consulte produtos, quantidades e níveis mínimos.
          </p>
        </div>

        {/* <button className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white hover:bg-green-900">
          + Novo produto
        </button> */}
        <ProdutoModal />
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          titulo="Produtos cadastrados"
          valor={produtos.length.toString()}
          descricao="Itens diferentes no estoque"
          icone="📦"
        />

        <Card
          titulo="Quantidade total"
          valor={quantidadeTotal.toFixed(2)}
          descricao="Soma das quantidades cadastradas"
          icone="📊"
        />

        <Card
          titulo="Estoque baixo"
          valor={produtosAbaixoMinimo.length.toString()}
          descricao="Produtos que precisam de reposição"
          icone="⚠️"
          alerta
        />
      </section>

      {produtosAbaixoMinimo.length > 0 && (
        <section className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
          <h2 className="font-bold text-yellow-900">Atenção ao estoque</h2>

          <p className="mt-1 text-sm text-yellow-800">
            {produtosAbaixoMinimo.length} produto(s) atingiram ou ficaram abaixo
            da quantidade mínima.
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">Produtos armazenados</h2>

          <p className="mt-1 text-sm text-slate-500">
            {produtos.length} registros encontrados
          </p>
        </div>

        {produtos.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl">📦</div>

            <h3 className="mt-4 font-bold text-slate-800">
              Nenhum produto cadastrado
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Cadastre o primeiro produto do estoque.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3">Quantidade</th>
                  <th className="px-5 py-3">Estoque mínimo</th>
                  <th className="px-5 py-3">Situação</th>
                  <th className="px-5 py-3">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {produtos.map((produto) => {
                  const estoqueBaixo =
                    Number(produto.quantidade) <= Number(produto.estoque_min);

                  return (
                    <tr key={produto.id_produto} className="hover:bg-green-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
                            📦
                          </div>

                          <div>
                            <p className="font-semibold text-slate-800">
                              {produto.nome_produto}
                            </p>

                            <p className="text-xs text-slate-400">
                              Código #{produto.id_produto}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {produto.categoria}
                      </td>

                      <td className="px-5 py-4">
                        <strong className="text-slate-800">
                          {Number(produto.quantidade).toFixed(2)}
                        </strong>

                        <span className="ml-1 text-xs text-slate-400">
                          {produto.unidade_medida}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {Number(produto.estoque_min).toFixed(2)}{" "}
                        {produto.unidade_medida}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={
                            estoqueBaixo
                              ? "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                              : "rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                          }
                        >
                          {estoqueBaixo ? "Estoque baixo" : "Normal"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {/*<button className="font-semibold text-green-700 hover:text-green-900">
                          Movimentar
                        </button>*/}
                        <MovimentacaoModal
                          idProduto={produto.id_produto}
                          nomeProduto={produto.nome_produto}
                          quantidadeAtual={Number(produto.quantidade)}
                          unidadeMedida={produto.unidade_medida}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">Movimentações recentes</h2>

          <p className="mt-1 text-sm text-slate-500">
            Últimas entradas e saídas registradas
          </p>
        </div>

        {movimentacoes.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-4xl">📋</p>

            <p className="mt-3 font-semibold text-slate-700">
              Nenhuma movimentação registrada
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Quantidade</th>
                  <th className="px-5 py-3">Responsável</th>
                  <th className="px-5 py-3">Observação</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {movimentacoes.map((movimentacao) => (
                  <tr
                    key={movimentacao.id_movimentacao}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 text-slate-500">
                      {movimentacao.data_movimentacao.toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "America/Sao_Paulo",
                      })}
                    </td>

                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {movimentacao.produto.nome_produto}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={
                          movimentacao.tipo_movimento === "ENTRADA"
                            ? "rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                            : "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                        }
                      >
                        {movimentacao.tipo_movimento}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <strong
                        className={
                          movimentacao.tipo_movimento === "ENTRADA"
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {movimentacao.tipo_movimento === "ENTRADA" ? "+" : "-"}
                        {Number(movimentacao.quantidade_move).toFixed(2)}
                      </strong>

                      <span className="ml-1 text-xs text-slate-400">
                        {movimentacao.produto.unidade_medida}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {movimentacao.usuarios.nome_usuario}
                    </td>

                    <td className="max-w-64 truncate px-5 py-4 text-slate-500">
                      {movimentacao.observacao || "Sem observação"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type CardProps = {
  titulo: string;
  valor: string;
  descricao: string;
  icone: string;
  alerta?: boolean;
};

function Card({ titulo, valor, descricao, icone, alerta = false }: CardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{titulo}</p>

          <p className="mt-2 text-3xl font-bold text-slate-900">{valor}</p>
        </div>

        <div
          className={
            alerta
              ? "flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-xl"
              : "flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-xl"
          }
        >
          {icone}
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500">{descricao}</p>
    </article>
  );
}
