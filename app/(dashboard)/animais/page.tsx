import { prisma } from "@/app/lib/prisma";
import AnimalModal from "@/app/components/animalmodal";

export default async function AnimaisPage() {
  const animais = await prisma.animal.findMany({
    include: {
      especie: true,
    },
    orderBy: {
      criado_em: "desc",
    },
  });

  const especies = await prisma.especie.findMany({
    where: {
      status: "ATIVO",
    },
    orderBy: {
      nome_especie: "asc",
    },
  });

  const totalAtivos = animais.filter(
    (animal) => animal.status_animal === "ATIVO",
  ).length;

  const totalObservacao = animais.filter(
    (animal) => animal.saude_animal === "EM OBSERVAÇÃO",
  ).length;

  return (
    <div>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-green-700">
            Pecuária
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Gestão de animais
          </h1>

          <p className="mt-2 text-slate-500">
            Consulte e acompanhe os animais cadastrados.
          </p>
        </div>

        <AnimalModal especies={especies} />
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          titulo="Total do rebanho"
          valor={animais.length}
          descricao="Animais cadastrados"
          icone="🐄"
        />

        <Card
          titulo="Animais ativos"
          valor={totalAtivos}
          descricao="Presentes na propriedade"
          icone="✅"
        />

        <Card
          titulo="Em observação"
          valor={totalObservacao}
          descricao="Precisam de acompanhamento"
          icone="⚠️"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-900">Animais cadastrados</h2>

          <p className="mt-1 text-sm text-slate-500">
            {animais.length} registros encontrados
          </p>
        </div>

        {animais.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl">🐄</div>

            <h3 className="mt-4 font-bold text-slate-800">
              Nenhum animal cadastrado
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Cadastre o primeiro animal da propriedade.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Animal</th>
                  <th className="px-5 py-3">Espécie</th>
                  <th className="px-5 py-3">Raça</th>
                  <th className="px-5 py-3">Sexo</th>
                  <th className="px-5 py-3">Peso</th>
                  <th className="px-5 py-3">Saúde</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {animais.map((animal) => (
                  <tr key={animal.id_animal} className="hover:bg-green-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 font-bold text-green-800">
                          {animal.nome_animal.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <p className="font-semibold text-slate-800">
                            {animal.nome_animal}
                          </p>

                          <p className="text-xs text-slate-400">
                            Código #{animal.id_animal}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {animal.especie.nome_especie}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {animal.raca_animal || "Não informada"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {animal.sexo_animal === "M"
                        ? "Macho"
                        : animal.sexo_animal === "F"
                          ? "Fêmea"
                          : animal.sexo_animal}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {animal.peso_animal
                        ? `${Number(animal.peso_animal).toFixed(2)} kg`
                        : "Não informado"}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {animal.saude_animal || "Não informada"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={
                          animal.status_animal === "ATIVO"
                            ? "rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                            : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                        }
                      >
                        {animal.status_animal}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <button className="font-semibold text-green-700 hover:text-green-900">
                        Detalhes
                      </button>
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
  valor: number;
  descricao: string;
  icone: string;
};

function Card({ titulo, valor, descricao, icone }: CardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{titulo}</p>

          <p className="mt-2 text-3xl font-bold text-slate-900">{valor}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-xl">
          {icone}
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500">{descricao}</p>
    </article>
  );
}
