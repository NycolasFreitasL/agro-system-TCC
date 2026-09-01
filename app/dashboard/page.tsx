import Sidebar from "../components/sidebar";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">
            Dashboard
          </h1>

          <p className="mt-2 text-slate-500">
            Visão geral da sua produção agrícola.
          </p>
        </div>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Total de Animais
                </p>

                <h2 className="mt-2 text-3xl font-bold text-slate-800">
                  24
                </h2>
              </div>

              <span className="text-4xl">🐄</span>
            </div>

            <p className="mt-4 text-sm text-green-600">
              Rebanho cadastrado
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Plantações Ativas
                </p>

                <h2 className="mt-2 text-3xl font-bold text-slate-800">
                  6
                </h2>
              </div>

              <span className="text-4xl">🌱</span>
            </div>

            <p className="mt-4 text-sm text-green-600">
              Cultivos em andamento
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Itens em Estoque
                </p>

                <h2 className="mt-2 text-3xl font-bold text-slate-800">
                  128
                </h2>
              </div>

              <span className="text-4xl">📦</span>
            </div>

            <p className="mt-4 text-sm text-blue-600">
              Produtos armazenados
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Alertas
                </p>

                <h2 className="mt-2 text-3xl font-bold text-slate-800">
                  3
                </h2>
              </div>

              <span className="text-4xl">⚠️</span>
            </div>

            <p className="mt-4 text-sm text-red-600">
              Precisam de atenção
            </p>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-800">
              Resumo da Produção
            </h2>

            <div className="mt-6 flex h-64 items-center justify-center rounded-lg bg-slate-50">
              <p className="text-slate-400">
                Gráfico será adicionado aqui
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-800">
              Atividades Recentes
            </h2>

            <div className="mt-6 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <p className="font-medium text-slate-700">
                  Novo animal cadastrado
                </p>
                <p className="text-sm text-slate-400">Hoje</p>
              </div>

              <div className="border-b border-slate-100 pb-3">
                <p className="font-medium text-slate-700">
                  Plantio de milho registrado
                </p>
                <p className="text-sm text-slate-400">Ontem</p>
              </div>

              <div>
                <p className="font-medium text-slate-700">
                  Estoque de ração atualizado
                </p>
                <p className="text-sm text-slate-400">
                  2 dias atrás
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}