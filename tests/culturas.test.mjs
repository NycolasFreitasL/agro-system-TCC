// Testes isolados: Prisma e sessão são simulados; nenhum banco é acessado.
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
    Response,
    Request,
    Date,
    Error,
    console,
    require(nome) {
      assert.ok(Object.hasOwn(dependencias, nome), `Importação não simulada: ${nome}`);
      return dependencias[nome];
    },
  }, { filename: arquivo });
  return exports;
}

class ErroAutenticacao extends Error {
  constructor(mensagem = "Acesso negado.", status = 401) {
    super(mensagem);
    this.status = status;
  }
}

const dadosBase = {
  nome: "Café",
  dias_germinacao_min: "5",
  dias_germinacao_max: "10",
  ciclo_dias_min: "120",
  ciclo_dias_max: "180",
  produtividade_min_kg_ha: "100.5",
  produtividade_max_kg_ha: "2500",
};

function bancoSimulado() {
  const culturas = [];
  let proximoId = 1;
  let fila = Promise.resolve();
  let autorizado = true;
  const prisma = {
    cultura: {
      findMany: async () => culturas.map((cultura) => ({
        ...cultura,
        _count: { produto: 0, plantio: 0 },
      })),
    },
    async $transaction(funcao) {
      const anterior = fila;
      let liberar;
      fila = new Promise((resolve) => { liberar = resolve; });
      await anterior;
      const tx = {
        async $queryRaw() {},
        cultura: {
          findFirst: async ({ where }) => culturas.find((cultura) =>
            cultura.nome_cultura.toLocaleLowerCase() ===
              where.nome_cultura.equals.toLocaleLowerCase() &&
            cultura.id_cultura !== where.id_cultura?.not,
          ) ?? null,
          findUnique: async ({ where }) => culturas.find((cultura) =>
            cultura.id_cultura === where.id_cultura,
          ) ?? null,
          create: async ({ data }) => {
            const cultura = {
              id_cultura: proximoId++,
              ...data,
              criado_em: new Date(),
              atualizado_em: new Date(),
            };
            culturas.push(cultura);
            return cultura;
          },
          update: async ({ where, data }) => {
            const index = culturas.findIndex((item) => item.id_cultura === where.id_cultura);
            culturas[index] = { ...culturas[index], ...data };
            return culturas[index];
          },
        },
      };
      try {
        return await funcao(tx);
      } finally {
        liberar();
      }
    },
  };
  const sessao = {
    ErroAutenticacao,
    exigirProprietario: async () => {
      if (!autorizado) throw new ErroAutenticacao("Somente proprietário.", 403);
      return { id_usuario: 1, permissao_usuario: "PROPRIETARIO" };
    },
  };
  return {
    prisma,
    culturas,
    setAutorizado(valor) { autorizado = valor; },
    api: carregar("app/api/fazenda/culturas/route.ts", {
      "@/app/lib/prisma": { prisma },
      "@/app/lib/sessao": sessao,
    }),
  };
}

function requisicao(dados) {
  return new Request("http://teste.local/api/fazenda/culturas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}

test("administração exige proprietário para listar e cadastrar", async () => {
  const db = bancoSimulado();
  db.setAutorizado(false);
  assert.equal((await db.api.GET()).status, 403);
  assert.equal((await db.api.POST(requisicao(dadosBase))).status, 403);
  assert.equal(db.culturas.length, 0);
});

test("cadastra cultura com números normalizados e lista o estado", async () => {
  const db = bancoSimulado();
  const resposta = await db.api.POST(requisicao(dadosBase));
  assert.equal(resposta.status, 201);
  assert.equal(db.culturas[0].produtividade_min_kg_ha, "100.50");
  assert.equal(db.culturas[0].ativo, true);
  const lista = await db.api.GET();
  assert.equal(lista.status, 200);
  assert.equal((await lista.json()).culturas[0].nome_cultura, "Café");
});

test("rejeita intervalos invertidos e valores fora do formato do banco", async () => {
  const db = bancoSimulado();
  for (const dados of [
    { ...dadosBase, dias_germinacao_min: "11" },
    { ...dadosBase, ciclo_dias_max: "0" },
    { ...dadosBase, produtividade_min_kg_ha: "2500.01" },
    { ...dadosBase, produtividade_max_kg_ha: "100000000" },
  ]) {
    assert.equal((await db.api.POST(requisicao(dados))).status, 400);
  }
  assert.equal(db.culturas.length, 0);
});

test("impede nomes iguais ignorando caixa, inclusive em cadastros concorrentes", async () => {
  const db = bancoSimulado();
  const resultados = await Promise.all([
    db.api.POST(requisicao(dadosBase)),
    db.api.POST(requisicao({ ...dadosBase, nome: "CAFÉ" })),
  ]);
  assert.deepEqual(await resultsStatus(resultados), [201, 409]);
  assert.equal(db.culturas.length, 1);
});

test("edita, desativa e reativa sem excluir o registro", async () => {
  const db = bancoSimulado();
  await db.api.POST(requisicao(dadosBase));
  const editar = (dados) => new Request("http://teste.local/api/fazenda/culturas", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  assert.equal((await db.api.PATCH(editar({ id: 1, ...dadosBase, nome: "Café Arábica", ativo: false }))).status, 200);
  assert.equal(db.culturas[0].nome_cultura, "Café Arábica");
  assert.equal(db.culturas[0].ativo, false);
  assert.equal((await db.api.PATCH(editar({ id: 1, ...dadosBase, nome: "Café Arábica", ativo: true }))).status, 200);
  assert.equal(db.culturas[0].ativo, true);
  assert.equal(db.culturas.length, 1);
  assert.equal(typeof db.api.DELETE, "undefined");
});

function resultsStatus(resultados) {
  return Promise.all(resultados.map((resposta) => resposta.status));
}

test("componente lista culturas ativas/inativas e campos administrativos", () => {
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const runtime = { jsx, jsxs: jsx, Fragment: "fragment" };
  const estados = [false, null, {}, false, "", ""];
  const componente = carregar("app/components/fazenda-culturas.tsx", {
    "react/jsx-runtime": runtime,
    react: {
      useRef: (current) => ({ current }),
      useState: (initial) => [estados.shift() ?? initial, () => {}],
    },
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
  }).default;
  const arvore = componente({ culturas: [
    { id: 1, nome: "Soja", diasGerminacaoMin: 5, diasGerminacaoMax: 10, cicloDiasMin: 100, cicloDiasMax: 130, produtividadeMin: "100", produtividadeMax: "200", ativo: true, produtos: 1, plantios: 2 },
    { id: 2, nome: "Café", diasGerminacaoMin: 5, diasGerminacaoMax: 10, cicloDiasMin: 100, cicloDiasMax: 130, produtividadeMin: "100", produtividadeMax: "200", ativo: false, produtos: 0, plantios: 0 },
  ] });
  const textos = [];
  function visitar(no) {
    if (Array.isArray(no)) return no.forEach(visitar);
    if (!no || typeof no !== "object") {
      if (typeof no === "string") textos.push(no);
      return;
    }
    if (typeof no.type === "function") return visitar(no.type(no.props));
    visitar(no.props?.children);
  }
  visitar(arvore);
  assert.ok(textos.includes("Soja"));
  assert.ok(textos.includes("Café"));
  assert.ok(textos.includes("Ativa"));
  assert.ok(textos.includes("Inativa"));
  assert.ok(textos.includes("Nova cultura"));
});
