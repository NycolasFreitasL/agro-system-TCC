// Testes isolados: não importam Prisma, sessão ou upload reais, nem leem .env.
// O mutex abaixo simula bloqueios; não comprova a concorrência no PostgreSQL.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { File } from "node:buffer";
import vm from "node:vm";
import ts from "typescript";

function carregar(arquivo, dependencias = {}) {
  const fonte = readFileSync(new URL(`../${arquivo}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(fonte, {
    fileName: arquivo,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, Response, Request, File, URL, Date, Intl, Error, console,
    require(nome) {
      assert.ok(Object.hasOwn(dependencias, nome), `Importação real bloqueada: ${nome}`);
      return dependencias[nome];
    },
  }, { filename: arquivo });
  return exports;
}

const regras = carregar("app/lib/estoque-regras.ts");
class ErroAutenticacao extends Error {
  status = 401;
}
const usuario = { id_usuario: 7, permissao_usuario: "PROPRIETARIO" };
const sessao = {
  ErroAutenticacao,
  exigirUsuario: async () => usuario,
  exigirProprietario: async () => usuario,
  obterUsuarioAtual: async () => usuario,
};
function rota(arquivo, prisma, extra = {}) {
  return carregar(`app/api/${arquivo}/route.ts`, {
    "@/app/lib/prisma": { prisma },
    "@/app/lib/sessao": sessao,
    "@/app/lib/estoque-regras": regras,
    ...extra,
  });
}
function requisicao(dados) {
  return new Request("http://teste.local/api", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}

function bancoSimulado(produtos = []) {
  const estado = { produtos: structuredClone(produtos), movimentos: [], vacinas: [], alimentos: [], animais: [] };
  let especie = { id_especie: 1, status: "ATIVO" };
  const filas = new Map();
  const eventos = [];
  let numeroTx = 0;
  const prisma = {
    especie: { findUnique: async () => especie },
    animal: { findUnique: async () => ({ status_animal: "ATIVO", data_nascimento: new Date("2020-01-01") }) },
    produto: { findMany: async () => estado.produtos },
    async $transaction(funcao, opcoes) {
      const txId = ++numeroTx;
      eventos.push([txId, "inicio", opcoes]);
      const liberar = [];
      const desfazer = [];
      async function bloquear(chave) {
        const anterior = filas.get(chave) ?? Promise.resolve();
        let resolver;
        const fim = new Promise((resolve) => { resolver = resolve; });
        filas.set(chave, fim);
        await anterior;
        liberar.push(resolver);
        eventos.push([txId, "bloqueio", chave]);
      }
      function inserir(lista, valor) {
        lista.push(valor);
        desfazer.push(() => lista.splice(lista.indexOf(valor), 1));
        return valor;
      }
      const produto = {
        findUnique: async ({ where }) => estado.produtos.find((p) => p.id_produto === where.id_produto),
        findUniqueOrThrow: async (args) => {
          const p = await produto.findUnique(args);
          assert.ok(p);
          return p;
        },
        create: async ({ data }) => inserir(estado.produtos, { ...data, id_produto: estado.produtos.length + 1 }),
        updateMany: async ({ where, data }) => {
          const p = await produto.findUnique({ where });
          const atual = Number(p.quantidade);
          if ((where.quantidade.gte !== undefined && atual < Number(where.quantidade.gte)) ||
              (where.quantidade.lte !== undefined && atual > Number(where.quantidade.lte))) return { count: 0 };
          const anterior = p.quantidade;
          p.quantidade = (atual + Number(data.quantidade.increment ?? 0) - Number(data.quantidade.decrement ?? 0)).toFixed(2);
          desfazer.push(() => { p.quantidade = anterior; });
          return { count: 1 };
        },
      };
      const tx = {
        async $queryRaw(partes, ...valores) {
          const sql = partes.join("?");
          if (sql.includes("pg_advisory_xact_lock")) {
            await bloquear(sql.match(/73142,\s*(\d+)/)[1]);
          } else if (sql.includes("FOR UPDATE")) {
            await bloquear(`${sql.includes("FROM especie") ? "especie" : sql.includes("FROM animal") ? "animal" : "produto"}:${valores[0]}`);
          } else if (sql.includes("lower(nome_produto)")) {
            return estado.produtos.filter((p) => p.nome_produto.toLowerCase() === valores[0].toLowerCase());
          } else assert.fail(`SQL não simulado: ${sql}`);
          return [];
        },
        produto,
        animal: {
          ...prisma.animal,
          create: async ({ data }) => {
            eventos.push([txId, "animal.create"]);
            return inserir(estado.animais, { ...data, id_animal: 1 });
          },
        },
        especie: {
          findUnique: async () => { eventos.push([txId, "especie.findUnique"]); return especie; },
          findFirst: async () => null,
          update: async ({ data }) => { especie = { ...especie, ...data }; },
        },
        move_estoque: { create: async ({ data }) => inserir(estado.movimentos, data) },
        vacinacao: { create: async ({ data }) => inserir(estado.vacinas, { ...data, id_vacina: 1 }) },
        alimentacao: { create: async ({ data }) => inserir(estado.alimentos, { ...data, id_alimentacao: 1 }) },
      };
      try { return await funcao(tx); }
      catch (error) { desfazer.reverse().forEach((acao) => acao()); throw error; }
      finally { eventos.push([txId, "fim"]); liberar.reverse().forEach((acao) => acao()); }
    },
  };
  return { prisma, estado, eventos };
}

const produtoDose = (extras = {}) => ({
  id_produto: 1, nome_produto: "Vacina A", categoria: "Vacina",
  unidade_medida: "Dose", quantidade: "10.00", estoque_min: "2.00", ...extras,
});
const cadastro = (extras = {}) => ({
  nome: "Vacina A", categoria: "Vacina", unidadeMedida: "DOSE",
  quantidade: "10", estoqueMinimo: "2", ...extras,
});
const manejo = (extras = {}) => ({ idAnimal: 1, idProduto: 1, quantidade: "2", data: "2025-01-01", ...extras });

test("alerta inclui igualdade, saldo zero com mínimo zero e valores abaixo", () => {
  for (const [saldo, minimo, esperado] of [[2, 2, true], [1, 2, true], [0, 0, true], [2.01, 2, false]]) {
    assert.equal(regras.noMinimoOuAbaixo(saldo, minimo), esperado);
  }
});

for (const [nome, dados] of [
  ["vacina em ML", cadastro({ unidadeMedida: "ML" })],
  ["saldo fracionado em Dose", cadastro({ quantidade: "1.5" })],
  ["mínimo fracionado em Dose", cadastro({ estoqueMinimo: "0.01" })],
  ["categoria não vacina com fração em Dose", cadastro({ categoria: "Outro", quantidade: "1.01" })],
]) {
  test(`cadastro rejeita ${nome} sem escrita`, async () => {
    const db = bancoSimulado();
    assert.equal((await rota("estoque/produtos", db.prisma).POST(requisicao(dados))).status, 400);
    assert.equal(db.estado.produtos.length, 0);
    assert.equal(db.estado.movimentos.length, 0);
  });
}
test("cadastro aceita zero e inteiros em Dose; KG mantém duas casas", async () => {
  const db = bancoSimulado();
  const api = rota("estoque/produtos", db.prisma);
  for (const dados of [cadastro({ quantidade: "0", estoqueMinimo: "0" }),
    cadastro({ nome: "Vacina B", quantidade: "99999999", estoqueMinimo: "1.00" }),
    cadastro({ nome: "Alimento", categoria: "Alimentação", unidadeMedida: "KG", quantidade: "1.25" })]) {
    assert.equal((await api.POST(requisicao(dados))).status, 201);
  }
  assert.equal(db.estado.produtos[1].quantidade, "99999999.00");
  assert.equal(db.estado.movimentos.length, 2);
});
test("cadastros concorrentes com caixa diferente resultam em um 201 e um 409 amigável", async () => {
  const db = bancoSimulado();
  const api = rota("estoque/produtos", db.prisma);
  const respostas = await Promise.all([api.POST(requisicao(cadastro())), api.POST(requisicao(cadastro({ nome: "vAcInA a" })))]);
  assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 409]);
  assert.match((await respostas.find((r) => r.status === 409).json()).error, /Já existe um produto cadastrado/);
  assert.equal(db.estado.produtos.length, 1);
  assert.equal(db.estado.movimentos.length, 1);
  assert.ok(db.eventos.filter((e) => e[1] === "inicio").every((e) => e[2].isolationLevel === "ReadCommitted"));
});
test("nomes contendo % ou _ são comparados por igualdade", async () => {
  const db = bancoSimulado();
  const api = rota("estoque/produtos", db.prisma);
  for (const nome of ["Vacina A", "Vacina%", "Vacina_"]) {
    assert.equal((await api.POST(requisicao(cadastro({ nome })))).status, 201);
  }
});

for (const tipo of ["ENTRADA", "SAIDA"]) {
  test(`movimentação ${tipo} rejeita fração em Dose e mantém saldo/histórico`, async () => {
    const db = bancoSimulado([produtoDose()]);
    const resposta = await rota("estoque/movimentacoes", db.prisma).POST(requisicao({ idProduto: 1, tipo, quantidade: "0.25" }));
    assert.equal(resposta.status, 400);
    assert.equal(db.estado.produtos[0].quantidade, "10.00");
    assert.equal(db.estado.movimentos.length, 0);
  });
}
test("movimentação inteira registra responsável, saldo e histórico; insuficiência não escreve", async () => {
  const db = bancoSimulado([produtoDose()]);
  const api = rota("estoque/movimentacoes", db.prisma);
  assert.equal((await api.POST(requisicao({ idProduto: 1, tipo: "SAIDA", quantidade: "2.00" }))).status, 201);
  assert.equal(db.estado.produtos[0].quantidade, "8.00");
  assert.equal(db.estado.movimentos[0].id_usuario, 7);
  assert.equal((await api.POST(requisicao({ idProduto: 1, tipo: "SAIDA", quantidade: "9" }))).status, 400);
  assert.equal(db.estado.movimentos.length, 1);
});
test("entrada em Dose rejeita ultrapassar o limite sem ajustar saldo", async () => {
  const db = bancoSimulado([produtoDose({ quantidade: "99999999.00" })]);
  const resposta = await rota("estoque/movimentacoes", db.prisma).POST(requisicao({ idProduto: 1, tipo: "ENTRADA", quantidade: "1" }));
  assert.equal(resposta.status, 400);
  assert.equal(db.estado.produtos[0].quantidade, "99999999.00");
  assert.equal(db.estado.movimentos.length, 0);
});
for (const alteracao of [{ quantidade: "1.5" }, { estoque_min: "0.5" }, { unidade_medida: "ML" }]) {
  test(`movimentação bloqueia legado incompatível ${JSON.stringify(alteracao)} sem arredondar`, async () => {
    const db = bancoSimulado([produtoDose(alteracao)]);
    const antes = structuredClone(db.estado);
    const resposta = await rota("estoque/movimentacoes", db.prisma).POST(requisicao({ idProduto: 1, tipo: "ENTRADA", quantidade: "1" }));
    assert.equal(resposta.status, 409);
    assert.match((await resposta.json()).error, /incompatível|conversão automática/);
    assert.deepEqual(db.estado, antes);
  });
}
test("vacinação lista somente saldos compatíveis e explica ML, mínimo/saldo fracionado", async () => {
  const db = bancoSimulado([produtoDose(), produtoDose({ id_produto: 2, unidade_medida: "ML" }),
    produtoDose({ id_produto: 3, quantidade: "1.5" }), produtoDose({ id_produto: 4, estoque_min: "0.5" }),
    produtoDose({ id_produto: 5, quantidade: "0" })]);
  const resposta = await rota("animais/vacinacoes", db.prisma).GET(new Request("http://teste.local/api?idAnimal=1"));
  const dados = await resposta.json();
  assert.deepEqual(dados.produtos.map((p) => p.id), [1]);
  assert.deepEqual(dados.incompatibilidades.map((p) => p.id), [2, 3, 4]);
});
for (const quantidade of ["0", "1.5", "1000"]) {
  test(`vacinação preserva limite existente: rejeita ${quantidade}`, async () => {
    const db = bancoSimulado([produtoDose()]);
    assert.equal((await rota("animais/vacinacoes", db.prisma).POST(requisicao(manejo({ quantidade })))).status, 400);
    assert.equal(db.estado.movimentos.length, 0);
  });
}
test("vacinação bloqueia saldo antigo fracionado; preserva data de nascimento e estoque suficiente", async () => {
  const db = bancoSimulado([produtoDose({ quantidade: "10.5" })]);
  const api = rota("animais/vacinacoes", db.prisma);
  assert.equal((await api.POST(requisicao(manejo()))).status, 409);
  db.estado.produtos[0].quantidade = "10.00";
  assert.equal((await api.POST(requisicao(manejo({ data: "2019-01-01" })))).status, 400);
  assert.equal((await api.POST(requisicao(manejo({ data: "2999-01-01" })))).status, 400);
  assert.equal((await api.POST(requisicao(manejo({ quantidade: "11" })))).status, 400);
  assert.equal((await api.POST(requisicao(manejo()))).status, 201);
  assert.equal(db.estado.produtos[0].quantidade, "8.00");
  assert.equal(db.estado.vacinas[0].unidade_dose, "DOSE");
  assert.equal(db.estado.movimentos.length, 1);
});
test("alimentação em Dose rejeita fração; em KG mantém frações", async () => {
  const db = bancoSimulado([produtoDose({ categoria: "Alimentação" })]);
  const api = rota("animais/alimentacoes", db.prisma);
  assert.equal((await api.POST(requisicao(manejo({ unidade: "Dose", quantidade: "0.5" })))).status, 400);
  assert.equal((await api.POST(requisicao(manejo({ unidade: "Dose" })))).status, 201);
  db.estado.produtos[0].unidade_medida = "KG";
  assert.equal((await api.POST(requisicao(manejo({ unidade: "KG", quantidade: "0.5" })))).status, 201);
  assert.equal(db.estado.produtos[0].quantidade, "7.50");
});
test("alimentação sinaliza e bloqueia saldo incompatível em Dose", async () => {
  const db = bancoSimulado([produtoDose({ categoria: "Alimentação", quantidade: "2.5" })]);
  const api = rota("animais/alimentacoes", db.prisma);
  const dados = await (await api.GET(new Request("http://teste.local/api?idAnimal=1"))).json();
  assert.match(dados.produtos[0].incompatibilidade, /Saldo antigo incompatível/);
  assert.equal((await api.POST(requisicao(manejo({ unidade: "Dose" })))).status, 409);
  assert.equal(db.estado.produtos[0].quantidade, "2.5");
});
test("sessão inválida interrompe rotas de escrita antes de transações", async () => {
  for (const caminho of ["estoque/produtos", "estoque/movimentacoes", "animais/vacinacoes", "animais/alimentacoes"]) {
    const db = bancoSimulado();
    const api = rota(caminho, db.prisma, { "@/app/lib/sessao": {
      ...sessao, exigirUsuario: async () => { throw new ErroAutenticacao(); },
    } });
    assert.equal((await api.POST(requisicao({}))).status, 401);
    assert.equal(db.eventos.length, 0);
  }
});
test("desativação após upload é revalidada; foto nova é removida fora da transação", async () => {
  const db = bancoSimulado();
  const especies = rota("fazenda/especies", db.prisma);
  const removidas = [];
  const animais = rota("animais", db.prisma, { "@/app/lib/fotos-animais": {
    ErroFoto: class extends Error {},
    enviarFotoAnimal: async () => {
      assert.equal(db.eventos.length, 0, "upload antes da transação");
      const r = await especies.PATCH(requisicao({ id: 1, nome: "Bovino", status: "INATIVO" }));
      assert.equal(r.status, 200);
      return { url: "https://teste.local/nova.jpg", publicId: "nova" };
    },
    removerFotoAnimal: async (id) => { removidas.push(id); },
  } });
  const valores = new Map([ ["nome", "Animal"], ["especie", "1"], ["sexo", "M"], ["foto", new File(["imagem"], "foto.jpg")] ]);
  const resposta = await animais.POST({
    headers: new Headers({ "content-type": "multipart/form-data" }),
    formData: async () => ({ get: (nome) => valores.get(nome) ?? null }),
  });
  assert.equal(resposta.status, 400);
  assert.equal(db.estado.animais.length, 0);
  assert.deepEqual(removidas, ["nova"]);
  const sequencia = db.eventos.filter((e) => e[0] === 2).map((e) => e[1]);
  assert.deepEqual(sequencia, ["inicio", "bloqueio", "especie.findUnique", "fim"]);
});
test("animal ativo é salvo somente após bloqueio e revalidação da espécie", async () => {
  const db = bancoSimulado();
  const api = rota("animais", db.prisma, { "@/app/lib/fotos-animais": {
    ErroFoto: class extends Error {},
    enviarFotoAnimal: async () => assert.fail("upload inesperado"),
    removerFotoAnimal: async () => assert.fail("remoção inesperada"),
  } });
  assert.equal((await api.POST(requisicao({ nome: "Animal", especie: 1, sexo: "F" }))).status, 201);
  assert.deepEqual(db.eventos.map((e) => e[1]), ["inicio", "bloqueio", "especie.findUnique", "animal.create", "fim"]);
});

const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: "fragment" };
function componente(arquivo, estados) {
  return carregar(`app/components/${arquivo}.tsx`, {
    "react/jsx-runtime": jsxRuntime,
    react: {
      useId: () => "modal", useEffect: () => {}, useRef: (valor) => ({ current: valor }),
      useState: () => [estados.shift(), () => {}],
    },
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/app/lib/estoque-regras": regras,
    "@/app/components/ui-icon": carregar("app/components/ui-icon.tsx", { "react/jsx-runtime": jsxRuntime }),
  }).default;
}
function elementos(arvore) {
  if (Array.isArray(arvore)) return arvore.flatMap(elementos);
  if (!arvore || typeof arvore !== "object") return [];
  if (typeof arvore.type === "function") return elementos(arvore.type(arvore.props));
  return [arvore, ...elementos(arvore.props.children)];
}
test("Dashboard e filtro da listagem incluem os mesmos produtos no limite", async () => {
  const produtos = [produtoDose({ nome_produto: "Igual", quantidade: 2, estoque_min: 2 }),
    produtoDose({ id_produto: 2, nome_produto: "Zero", quantidade: 0, estoque_min: 0 }),
    produtoDose({ id_produto: 3, nome_produto: "Acima", quantidade: 3, estoque_min: 2 })];
  const dashboard = carregar("app/(dashboard)/dashboard/page.tsx", {
    "react/jsx-runtime": jsxRuntime, "next/link": { default: "a", __esModule: true },
    "next/navigation": { redirect: () => assert.fail("redirect inesperado") },
    "@/app/components/productionChart": { default: () => null, __esModule: true },
    "@/app/lib/estoque-regras": regras, "@/app/lib/sessao": sessao,
    "@/app/lib/prisma": { prisma: {
      animal: { count: async () => 0 }, plantio: { count: async () => 0 },
      produto: { findMany: async () => produtos },
      colheita: { findMany: async () => [] }, move_estoque: { findMany: async () => [] },
    } },
  });
  const alertas = elementos(await dashboard.default()).filter((e) => e.type === "li").map((e) => e.key);
  assert.deepEqual([...alertas].sort(), [1, 2]);
  const estados = ["", true, "", "BAIXO"];
  const painel = carregar("app/components/estoque-painel.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: { useId: () => "filtros", useState: () => [estados.shift(), () => {}] },
    "@/app/lib/estoque-regras": regras,
    "@/app/components/produtomodal": { default: () => null, __esModule: true },
    "@/app/components/movimentacaomodal": { default: () => null, __esModule: true },
  });
  const linhas = elementos(painel.default({ produtos, movimentacoes: [], movimentacoesHoje: 0 }))
    .filter((e) => e.type === "tr" && e.key !== undefined).map((e) => e.key);
  assert.deepEqual(linhas.sort(), [...alertas].sort());
});
test("formulário de vacina restringe unidade a Dose e usa passo inteiro nos dois campos", () => {
  const Modal = componente("produtomodal", [true, false, "", "Vacina", "DOSE", [], false, ""]);
  const nos = elementos(Modal());
  const unidade = nos.find((e) => e.type === "select" && e.props.name === "unidadeMedida");
  assert.deepEqual(elementos(unidade).filter((e) => e.type === "option").map((e) => e.props.value), ["", "DOSE"]);
  for (const nome of ["quantidade", "estoqueMinimo"]) {
    const input = nos.find((e) => e.type === "input" && e.props.name === nome);
    assert.equal(input.props.step, "1");
    assert.equal(input.props.max, "99999999");
  }
});
test("formulário de alimentação em Dose tem passo inteiro e bloqueia legado incompatível", () => {
  const Modal = componente("animal-alimentacao", [true, false, false, "", "", 0,
    [{ id: 1, nome: "Alimento", saldo: "2.5", unidade: "Dose", incompatibilidade: "Saldo antigo incompatível" }],
    "1", "", "", "", null]);
  const nos = elementos(Modal({ idAnimal: 1, ativo: true }));
  const input = nos.find((e) => e.type === "input" && e.props.type === "number");
  assert.equal(input.props.step, "1");
  assert.equal(input.props.min, "1");
  assert.equal(nos.find((e) => e.type === "button" && e.props.type === "submit").props.disabled, true);
  assert.ok(nos.some((e) => e.props.role === "alert"));
});
test("movimentação em Dose bloqueia frações e mostra incompatibilidade de vacina em ML", () => {
  for (const [produto, quantidade] of [[produtoDose({ quantidade: 10, estoque_min: 2 }), "0.5"],
    [produtoDose({ unidade_medida: "ML", quantidade: 10, estoque_min: 2 }), "1"]]) {
    const Modal = componente("movimentacaomodal", [true, false, "", "1", "ENTRADA", quantidade, ""]);
    const nos = elementos(Modal({ produtos: [produto] }));
    assert.equal(nos.find((e) => e.type === "button" && e.props.type === "submit").props.disabled, true);
    if (produto.unidade_medida === "Dose") {
      assert.equal(nos.find((e) => e.type === "input" && e.props.type === "number").props.step, "1");
    } else assert.ok(nos.some((e) => e.props.role === "alert"));
  }
});
