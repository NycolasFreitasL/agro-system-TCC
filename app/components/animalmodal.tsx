"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Especie = {
  id_especie: number;
  nome_especie: string;
};

type AnimalModalProps = {
  especies: Especie[];
};

const estiloCampo = "input";

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

export default function AnimalModal({
  especies,
}: AnimalModalProps) {
  const router = useRouter();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const enviandoRef = useRef(false);

  const tituloId = useId();

  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState("");
  const [hoje, setHoje] = useState("");

  useEffect(() => {
    return () => {
      if (previa) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  function atualizarFoto(arquivo: File | null) {
    setFoto(arquivo);
    setPrevia(arquivo ? URL.createObjectURL(arquivo) : "");
  }

  useEffect(() => {
    if (!aberto) {
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const overflowAnterior = document.body.style.overflow;

    if (!dialog.open) {
      dialog.showModal();
    }

    document.body.style.overflow = "hidden";

    return () => {
      dialog.close();
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto]);

  function abrirModal() {
    setErro("");
    atualizarFoto(null);
    setHoje(hojeEmSaoPaulo());
    setAberto(true);
  }

  function fecharModal() {
    if (enviandoRef.current) {
      return;
    }

    setAberto(false);
    setErro("");
    atualizarFoto(null);
  }

  function selecionarFoto(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const arquivo = event.target.files?.[0];

    if (!arquivo) {
      return;
    }

    setErro("");

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        arquivo.type,
      )
    ) {
      event.target.value = "";
      atualizarFoto(null);
      setErro("Selecione uma foto JPG, PNG ou WebP.");
      return;
    }

    if (
      arquivo.size === 0 ||
      arquivo.size > 2 * 1024 * 1024
    ) {
      event.target.value = "";
      atualizarFoto(null);
      setErro("A foto deve ter até 2 MB.");
      return;
    }

    atualizarFoto(arquivo);
  }

  function removerFoto() {
    atualizarFoto(null);

    if (arquivoRef.current) {
      arquivoRef.current.value = "";
    }
  }

  async function cadastrarAnimal(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (enviandoRef.current) {
      return;
    }

    const formulario = event.currentTarget;
    const dadosFormulario = new FormData(formulario);

    // Usa o arquivo que passou pela validação da prévia.
    dadosFormulario.delete("foto");

    if (foto) {
      dadosFormulario.set("foto", foto);
    }

    enviandoRef.current = true;
    setCarregando(true);
    setErro("");

    try {
      const resposta = await fetch("/api/animais", {
        method: "POST",
        body: dadosFormulario,
      });

      const dados = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        throw new Error(
          typeof dados?.error === "string"
            ? dados.error
            : "Não foi possível cadastrar o animal.",
        );
      }

      if (!dados?.animal?.id_animal) {
        throw new Error(
          "O servidor retornou uma resposta inesperada. Confira a listagem antes de tentar novamente.",
        );
      }

      formulario.reset();
      atualizarFoto(null);
      setAberto(false);
      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro inesperado.",
      );
    } finally {
      enviandoRef.current = false;
      setCarregando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrirModal}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#486d6b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#244b49]"
      >
        <Icone tipo="adicionar" />
        Novo animal
      </button>

      {aberto && (
        <dialog
          ref={dialogRef}
          aria-labelledby={tituloId}
          onCancel={(event) => {
            event.preventDefault();
            fecharModal();
          }}
          className="fixed inset-0 m-auto max-h-[92dvh] w-[94vw] max-w-3xl overflow-y-auto rounded-2xl border-0 bg-[#f5f5f5] p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50"
        >
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#486d6b]">
                Pecuária
              </p>

              <h2
                id={tituloId}
                className="mt-1 text-xl font-bold text-[#244b49] sm:text-2xl"
              >
                Cadastrar animal
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Preencha os dados de identificação do animal.
              </p>
            </div>

            <button
              type="button"
              onClick={fecharModal}
              disabled={carregando}
              aria-label="Fechar cadastro"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            >
              <Icone tipo="fechar" />
            </button>
          </header>

          <form
            onSubmit={cadastrarAnimal}
            className="space-y-5 p-4 sm:p-7"
            aria-busy={carregando}
          >
            <fieldset
              disabled={carregando}
              className="min-w-0 space-y-5"
            >
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-[#244b49]">
                  Foto do animal
                </h3>

                <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {previa ? (
                      // Prévia local do arquivo selecionado.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previa}
                        alt="Prévia da foto do animal"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Icone
                          tipo="camera"
                          className="h-9 w-9"
                        />
                        <span className="text-xs">
                          Sem foto
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <input
                      ref={arquivoRef}
                      type="file"
                      name="foto"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={selecionarFoto}
                      aria-label="Selecionar foto do animal"
                      className="hidden"
                    />

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => arquivoRef.current?.click()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#486d6b] px-4 py-2 text-sm font-semibold text-[#486d6b] hover:bg-[#486d6b]/5"
                      >
                        <Icone tipo="camera" />
                        {foto ? "Trocar foto" : "Selecionar foto"}
                      </button>

                      {foto && (
                        <button
                          type="button"
                          onClick={removerFoto}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Opcional. JPG, PNG ou WebP, até 2 MB.
                    </p>

                    {foto && (
                      <p className="mt-1 break-all text-xs text-slate-600">
                        {foto.name}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-[#244b49]">
                  Identificação
                </h3>

                <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                  <Campo titulo="Nome do animal" obrigatorio>
                    <input
                      name="nome"
                      required
                      maxLength={100}
                      placeholder="Ex.: Estrela"
                      className={estiloCampo}
                    />
                  </Campo>

                  <Campo titulo="Espécie" obrigatorio>
                    <select
                      name="especie"
                      required
                      defaultValue=""
                      className={estiloCampo}
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
                      maxLength={60}
                      placeholder="Ex.: Nelore"
                      className={estiloCampo}
                    />
                  </Campo>

                  <Campo titulo="Sexo" obrigatorio>
                    <select
                      name="sexo"
                      required
                      defaultValue=""
                      className={estiloCampo}
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
                      max={hoje || undefined}
                      className={estiloCampo}
                    />
                  </Campo>

                  <Campo titulo="Peso atual (kg)">
                    <input
                      name="peso"
                      type="number"
                      min="0.01"
                      max="9999.99"
                      step="0.01"
                      placeholder="Não informado"
                      className={estiloCampo}
                    />
                  </Campo>

                  <Campo titulo="Condição de saúde">
                    <select
                      name="saude"
                      defaultValue="SAUDÁVEL"
                      className={estiloCampo}
                    >
                      <option value="SAUDÁVEL">
                        Saudável
                      </option>
                      <option value="EM OBSERVAÇÃO">
                        Em observação
                      </option>
                      <option value="EM TRATAMENTO">
                        Em tratamento
                      </option>
                    </select>
                  </Campo>
                </div>
              </section>
            </fieldset>

            {especies.length === 0 && (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                Cadastre uma espécie ativa antes de adicionar
                animais.
              </p>
            )}

            {erro && (
              <p
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
              >
                {erro}
              </p>
            )}

            <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={fecharModal}
                disabled={carregando}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={carregando || especies.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#486d6b] px-6 py-3 text-sm font-semibold text-white hover:bg-[#244b49] disabled:cursor-wait disabled:opacity-60"
              >
                {!carregando && <Icone tipo="adicionar" />}
                {carregando
                  ? "Salvando cadastro..."
                  : "Cadastrar animal"}
              </button>
            </footer>
          </form>
        </dialog>
      )}
    </>
  );
}

function Campo({
  titulo,
  obrigatorio = false,
  children,
}: {
  titulo: string;
  obrigatorio?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-slate-700">
        {titulo}
        {obrigatorio && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>

      <div className="mt-2">{children}</div>
    </label>
  );
}

function Icone({
  tipo,
  className = "h-5 w-5",
}: {
  tipo: "adicionar" | "fechar" | "camera";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {tipo === "adicionar" && (
        <path d="M12 5v14M5 12h14" />
      )}

      {tipo === "fechar" && (
        <path d="m6 6 12 12M18 6 6 18" />
      )}

      {tipo === "camera" && (
        <>
          <path d="M8 5 6.5 8H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2.5L16 5Z" />
          <circle cx="12" cy="14" r="4" />
        </>
      )}
    </svg>
  );
}
