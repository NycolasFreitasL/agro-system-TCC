// Testes isolados com Prisma e React simulados; não conectam ao PostgreSQL.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    exports,
    Request,
    URL,
    Response,
    Date,
    Error,
    console,
    require(nome) {
      assert.ok(Object.hasOwn(dependencias, nome), `Importação real bloqueada: ${nome}`);
      return dependencias[nome];
    },
  }, { filename: arquivo });
  return exports;
}

class ErroAutenticacao extends Error {
  constructor(mensagem = "Somente proprietário.", status = 403) {
    super(mensagem);
    this.status = status;
  }
}

function criarRota({ status = "ATIVO", autorizado = true, encontrado = true } = {}) {
  const animal = {
    id_animal: 4,
    status_animal: status,
    nome_animal: "Estrela",
    id_especie: 2,
    foto_animal: "https://teste.local/estrela.jpg",
    atualizado_em: null,
  };
  const historicos = { alimentacoes: [{ id_alimentacao: 11 }], vacinacoes: [{ id_vacina: 12 }] };
  const chamadas = { transacoes: 0, bloqueios: 0, atualizacoes: 0 };
  const prisma = {
    async $transaction(callback, options) {
      chamadas.transacoes++;
      chamadas.options = options;
      return callback({
        async $queryRaw(strings) {
          assert.match(strings.join(""), /FOR UPDATE/);
          chamadas.bloqueios++;
          return [];
        },
        animal: {
          async findUnique() { return encontrado ? animal : null; },
          async update({ data }) {
            chamadas.atualizacoes++;
            Object.assign(animal, data);
            return animal;
          },
        },
      });
    },
  };
  const api = carregar("app/api/animais/status/route.ts", {
    "@/app/lib/prisma": { prisma },
    "@/app/lib/sessao": {
      ErroAutenticacao,
      exigirProprietario: async () => {
        if (!autorizado) throw new ErroAutenticacao();
        return { id_usuario: 1, permissao_usuario: "PROPRIETARIO" };
      },
    },
  });
  return { api, animal, historicos, chamadas };
}

function requisicao(dados, json = true) {
  return new Request("http://teste.local/api/animais/status", {
    method: "PATCH",
    headers: json ? { "Content-Type": "application/json" } : {},
    body: json ? JSON.stringify(dados) : "{inválido",
  });
}

test("inativa animal ativo preservando dados cadastrais sem excluir", async () => {
  const db = criarRota();
  const resposta = await db.api.PATCH(requisicao({ id: 4, status: "INATIVO" }));
  assert.equal(resposta.status, 200);
  assert.equal(db.animal.status_animal, "INATIVO");
  assert.equal(db.animal.nome_animal, "Estrela");
  assert.equal(db.animal.id_especie, 2);
  assert.equal(db.animal.foto_animal, "https://teste.local/estrela.jpg");
  assert.equal(db.historicos.alimentacoes.length, 1);
  assert.equal(db.historicos.vacinacoes.length, 1);
  assert.equal(db.chamadas.bloqueios, 1);
  assert.equal(db.chamadas.atualizacoes, 1);
  assert.equal(db.chamadas.options.isolationLevel, "ReadCommitted");
});

test("reativa animal inativo sem substituir outros dados", async () => {
  const db = criarRota({ status: "INATIVO" });
  const resposta = await db.api.PATCH(requisicao({ id: 4, status: "ATIVO" }));
  assert.equal(resposta.status, 200);
  assert.equal(db.animal.status_animal, "ATIVO");
  assert.equal(db.animal.nome_animal, "Estrela");
  assert.equal(db.animal.foto_animal, "https://teste.local/estrela.jpg");
});

test("animal inexistente retorna 404 sem atualizar", async () => {
  const db = criarRota({ encontrado: false });
  const resposta = await db.api.PATCH(requisicao({ id: 4, status: "INATIVO" }));
  assert.equal(resposta.status, 404);
  assert.equal(db.chamadas.atualizacoes, 0);
});

test("bloqueia proprietário ausente antes de abrir transação", async () => {
  const db = criarRota({ autorizado: false });
  assert.equal((await db.api.PATCH(requisicao({ id: 4, status: "INATIVO" }))).status, 403);
  assert.equal(db.chamadas.transacoes, 0);
  assert.equal(db.animal.status_animal, "ATIVO");
});

test("rejeita identificador, corpo e status inválidos", async () => {
  for (const [dados, json] of [
    [{ id: 0, status: "INATIVO" }, true],
    [{ id: 4.5, status: "INATIVO" }, true],
    [{ id: 4, status: "BAIXADO" }, true],
    [null, false],
  ]) {
    const db = criarRota();
    assert.equal((await db.api.PATCH(requisicao(dados, json))).status, 400);
    assert.equal(db.chamadas.transacoes, 0);
    assert.equal(db.animal.status_animal, "ATIVO");
  }
});

test("status persistido desconhecido é preservado e exige revisão manual", async () => {
  const db = criarRota({ status: "BAIXADO" });
  const resposta = await db.api.PATCH(requisicao({ id: 4, status: "ATIVO" }));
  assert.equal(resposta.status, 409);
  assert.equal(db.animal.status_animal, "BAIXADO");
  assert.equal(db.chamadas.atualizacoes, 0);
});

test("repetição do mesmo status é idempotente", async () => {
  const db = criarRota({ status: "INATIVO" });
  const resposta = await db.api.PATCH(requisicao({ id: 4, status: "INATIVO" }));
  assert.equal(resposta.status, 200);
  assert.equal(db.chamadas.atualizacoes, 0);
});

test("listagem padrão mostra ativos e filtro separado mostra inativos", () => {
  const runtime = {
    jsx: (type, props, key) => ({ type, props: props ?? {}, key }),
    jsxs: (type, props, key) => ({ type, props: props ?? {}, key }),
    Fragment: "fragment",
  };
  const estados = ["", "", "ATIVO", null];
  let indice = 0;
  const componente = carregar("app/components/animais-painel.tsx", {
    "react/jsx-runtime": runtime,
    react: {
      useState(inicial) {
        const atual = indice++;
        if (estados[atual] === undefined) estados[atual] = inicial;
        return [estados[atual], (valor) => { estados[atual] = typeof valor === "function" ? valor(estados[atual]) : valor; }];
      },
      useEffect() {},
      useId: () => "teste-id",
      useRef: (current) => ({ current }),
    },
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/app/components/animalmodal": { __esModule: true, default: () => null },
    "@/app/components/animal-historico": { __esModule: true, default: () => null },
    "@/app/components/animal-alimentacao": { __esModule: true, default: () => null },
    "@/app/components/animal-vacinacao": { __esModule: true, default: () => null },
  });
  const animais = [
    { id: 1, nome: "Ativa", especie: "Bovino", raca: null, sexo: "F", nascimento: null, peso: null, saude: null, foto: null, status: "ATIVO", criadoEm: null, alimentacoes: 0, vacinacoes: 0 },
    { id: 2, nome: "Inativa", especie: "Bovino", raca: null, sexo: "F", nascimento: null, peso: null, saude: null, foto: null, status: "INATIVO", criadoEm: null, alimentacoes: 1, vacinacoes: 1 },
  ];
  const painel = () => {
    indice = 0;
    return componente.default({ animais, especies: [], podeAdministrar: false });
  };
  function arvoreNos(node) {
    if (Array.isArray(node)) return node.flatMap(arvoreNos);
    if (!node || typeof node !== "object") return [];
    if (typeof node.type === "function") return arvoreNos(node.type(node.props));
    return [node, ...arvoreNos(node.props.children)];
  }
  let nos = arvoreNos(painel());
  assert.ok(nos.some((node) => node.props.value === "ATIVO" && node.props["aria-label"] === "Filtrar por status"));
  assert.ok(nos.some((node) => node.props.children === "Ativa"));
  assert.ok(!nos.some((node) => node.props.children === "Inativa"));
  nos.find((node) => node.props["aria-label"] === "Filtrar por status").props.onChange({ target: { value: "INATIVO" } });
  nos = arvoreNos(painel());
  assert.ok(nos.some((node) => node.props.children === "Inativa"));
  assert.ok(!nos.some((node) => node.props.children === "Ativa"));
});

test("history remains available for inactive animals", async () => {
  const alimentacao = {
    id_alimentacao: 11,
    data_alimentacao: new Date("2025-01-02T12:00:00.000Z"),
    quantidade_alimentacao: { toString: () => "2.00" },
    observacao: "history preserved",
    produto: { nome_produto: "Racao", unidade_medida: "KG" },
    usuarios: { nome_usuario: "Owner" },
  };
  const vacinacao = {
    id_vacina: 12,
    data_vacina: new Date("2025-01-03T12:00:00.000Z"),
    dose_vacina: { toString: () => "1.00" },
    unidade_dose: "DOSE",
    observacao: "vaccine preserved",
    produto: { nome_produto: "Vacina" },
    usuarios: { nome_usuario: "Owner" },
  };
  const consulta = { alimentacao: null, vacinacao: null };
  const api = carregar("app/api/animais/historico/route.ts", {
    "@/app/lib/prisma": { prisma: {
      animal: { findUnique: async () => ({ id_animal: 4, status_animal: "INATIVO" }) },
      alimentacao: { findMany: async (args) => { consulta.alimentacao = args; return [alimentacao]; } },
      vacinacao: { findMany: async (args) => { consulta.vacinacao = args; return [vacinacao]; } },
    } },
    "@/app/lib/sessao": { ErroAutenticacao, exigirUsuario: async () => ({ id_usuario: 2 }) },
  });

  const resposta = await api.GET(new Request("http://teste.local/api/animais/historico?idAnimal=4"));
  const dados = await resposta.json();
  assert.equal(resposta.status, 200);
  assert.deepEqual(dados.registros.map((registro) => registro.tipo).sort(), ["ALIMENTACAO", "VACINACAO"]);
  assert.equal(dados.registros.find((registro) => registro.tipo === "ALIMENTACAO").produto, "Racao");
  assert.equal(dados.registros.find((registro) => registro.tipo === "VACINACAO").produto, "Vacina");
  assert.equal(consulta.alimentacao.where.id_animal, 4);
  assert.equal(consulta.vacinacao.where.id_animal, 4);
});
