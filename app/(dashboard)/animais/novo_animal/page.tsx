import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";

export default async function NovoAnimalPage() {
  const especies = await prisma.especie.findMany({
    where: {
      status: "ATIVO",
    },
    orderBy: {
      nome_especie: "asc",
    },
  });

  async function cadastrarAnimal(formData: FormData) {
    "use server";

    const nome = formData.get("nome");
    const especie = formData.get("especie");
    const raca = formData.get("raca");
    const sexo = formData.get("sexo");
    const nascimento = formData.get("nascimento");
    const peso = formData.get("peso");
    const saude = formData.get("saude");

    if (
      typeof nome !== "string" ||
      !nome.trim() ||
      typeof especie !== "string" ||
      !especie ||
      typeof sexo !== "string" ||
      !sexo
    ) {
      throw new Error(
        "Nome, espécie e sexo são obrigatórios.",
      );
    }

    await prisma.animal.create({
      data: {
        nome_animal: nome.trim(),
        id_especie: Number(especie),
        raca_animal:
          typeof raca === "string" && raca.trim()
            ? raca.trim()
            : null,
        sexo_animal: sexo,
        data_nascimento:
          typeof nascimento === "string" && nascimento
            ? new Date(`${nascimento}T12:00:00`)
            : null,
        peso_animal:
          typeof peso === "string" && peso
            ? peso
            : null,
        saude_animal:
          typeof saude === "string" && saude
            ? saude
            : "SAUDÁVEL",
        status_animal: "ATIVO",
      },
    });

    revalidatePath("/animais");
    revalidatePath("/dashboard");

    redirect("/animais");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <Link
          href="/animais"
          className="text-sm font-semibold text-green-700 hover:text-green-900"
        >
          ← Voltar para animais
        </Link>

        <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-green-700">
          Pecuária
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Cadastrar novo animal
        </h1>

        <p className="mt-2 text-slate-500">
          Preencha os dados para adicionar um animal ao
          rebanho.
        </p>
      </header>

      <form
        action={cadastrarAnimal}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Campo titulo="Nome do animal" obrigatorio>
            <input
              name="nome"
              required
              placeholder="Ex.: Estrela"
              className="input"
            />
          </Campo>

          <Campo titulo="Espécie" obrigatorio>
            <select
              name="especie"
              required
              defaultValue=""
              className="input"
            >
              <option value="" disabled>
                Selecione a espécie
              </option>

              {especies.map((especie) => (
                <option
                  key={especie.id_especie}
                  value={especie.id_especie}
                >
                  {especie.nome_especie}
                </option>
              ))}
            </select>
          </Campo>

          <Campo titulo="Raça">
            <input
              name="raca"
              placeholder="Ex.: Nelore"
              className="input"
            />
          </Campo>

          <Campo titulo="Sexo" obrigatorio>
            <select
              name="sexo"
              required
              defaultValue=""
              className="input"
            >
              <option value="" disabled>
                Selecione
              </option>

              <option value="M">Macho</option>
              <option value="F">Fêmea</option>
            </select>
          </Campo>

          <Campo titulo="Data de nascimento">
            <input
              name="nascimento"
              type="date"
              className="input"
            />
          </Campo>

          <Campo titulo="Peso atual">
            <div className="relative">
              <input
                name="peso"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                className="input pr-12"
              />

              <span className="absolute right-4 top-3 text-sm text-slate-400">
                kg
              </span>
            </div>
          </Campo>

          <Campo titulo="Condição de saúde">
            <select
              name="saude"
              defaultValue="SAUDÁVEL"
              className="input"
            >
              <option value="SAUDÁVEL">Saudável</option>
              <option value="EM OBSERVAÇÃO">
                Em observação
              </option>
              <option value="EM TRATAMENTO">
                Em tratamento
              </option>
            </select>
          </Campo>
        </div>

        {especies.length === 0 && (
          <p className="mt-6 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
            Não existem espécies ativas cadastradas. Cadastre
            uma espécie antes de adicionar o animal.
          </p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          <Link
            href="/animais"
            className="rounded-xl border border-slate-300 px-5 py-3 text-center font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={especies.length === 0}
            className="rounded-xl bg-green-800 px-6 py-3 font-semibold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cadastrar animal
          </button>
        </div>
      </form>
    </div>
  );
}

type CampoProps = {
  titulo: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
};

function Campo({
  titulo,
  obrigatorio = false,
  children,
}: CampoProps) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">
        {titulo}

        {obrigatorio && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>

      <div className="mt-2">{children}</div>
    </label>
  );
}