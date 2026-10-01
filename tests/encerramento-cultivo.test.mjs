// Testes isolados dos módulos reais com dependências substituídas.
// Não leem .env, não conectam ao banco e não fazem uploads.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function carregar(arquivo, dependencias = {}, globais = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${arquivo}`, import.meta.url), "utf8"), {
    fileName: arquivo,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, Request, Response, URL, Date, Intl, Error, console,
    require(nome) { assert.ok(Object.hasOwn(dependencias, nome), `Importação real bloqueada: ${nome}`); return dependencias[nome]; },
    ...globais,
  }, { filename: arquivo });
  return exports;
}
const regras = carregar("app/lib/encerramento-cultivo.ts");
class ErroAutenticacao extends Error { status = 401; }
const usuario = { id_usuario: 8, nome_usuario: "Responsável atual" };
const sessao = { ErroAutenticacao, exigirUsuario: async () => usuario, obterUsuarioAtual: async () => usuario };
const plantioBase = () => ({
  id_plantio: 1, id_lote: 2, id_produto: 3, id_cultura: 4,
  area_plantada: "1.25", quantidade_plantada: "5.50", unidade_plantada: "KG",
  data_plantio: new Date("2025-01-01T00:00:00Z"), prev_colheita: null, prev_germinacao: null,
  status_plantio: "ATIVO", id_usuario: 5,
});
function request(extras = {}) {
  return new Request("http://teste.local/api/plantios/encerrar", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idPlantio: 1, tipoEncerramento: "PERDA", motivo: "Perda por estiagem", ...extras }),
  });
}
function simular({ colheitas = 0, status = "ATIVO", falharEvento = false, semPlantio = false, aposBloqueio } = {}) {
  const estado = { plantio: { ...plantioBase(), status_plantio: status }, eventos: [], colheitas, movimentos: ["histórico original"], sementes: "25.00" };
  const chamadas = [];
  const filas = new Map();
  let idTx = 0;
  const prisma = {
    async $transaction(funcao, opcoes) {
      const id = ++idTx;
      chamadas.push([id, "inicio", opcoes]);
      const liberar = [];
      const desfazer = [];
      const tx = {
        async $queryRaw(partes, ...valores) {
          const sql = partes.join("?");
          const tabela = sql.includes("FROM public.lote") ? "lote" : "plantio";
          assert.ok(sql.includes("FOR UPDATE"));
          const chave = `${tabela}:${valores[0]}`;
          const anterior = filas.get(chave) ?? Promise.resolve();
          let resolver;
          const fim = new Promise((resolve) => { resolver = resolve; });
          filas.set(chave, fim);
          await anterior;
          liberar.push(resolver);
          chamadas.push([id, "bloqueio", tabela]);
          if (tabela === "plantio") await aposBloqueio?.(estado);
          return [{ [tabela === "lote" ? "id_lote" : "id_plantio"]: valores[0] }];
        },
        plantio: {
          findUnique: async ({ select }) => {
            chamadas.push([id, "plantio.findUnique", Boolean(select)]);
            if (semPlantio) return null;
            return select ? { id_lote: estado.plantio.id_lote } : { ...estado.plantio };
          },
          update: async ({ data }) => {
            assert.deepEqual(Object.keys(data), ["status_plantio"], "apenas o status pode mudar");
            const antigo = estado.plantio.status_plantio;
            desfazer.push(() => { estado.plantio.status_plantio = antigo; });
            estado.plantio.status_plantio = data.status_plantio;
            chamadas.push([id, "plantio.update"]);
          },
        },
        colheita: { count: async () => { chamadas.push([id, "colheita.count"]); return estado.colheitas; } },
        evento_plantio: {
          findFirst: async ({ where }) => estado.eventos.find((e) => e.id_plantio === where.id_plantio && e.tipo === where.tipo) ?? null,
          create: async ({ data }) => {
            if (falharEvento === "P2002") throw { code: "P2002" };
            if (falharEvento) throw new Error("Falha simulada na gravação do evento");
            assert.ok(!Object.hasOwn(data, "registrado_em"), "a data vem do default do banco");
            assert.equal(estado.eventos.filter((e) => e.tipo === "ENCERRAMENTO").length, 0);
            const evento = { ...structuredClone(data), id_evento: 1, registrado_em: new Date("2026-10-01T15:00:00Z") };
            estado.eventos.push(evento);
            desfazer.push(() => estado.eventos.splice(estado.eventos.indexOf(evento), 1));
            return evento;
          },
        },
        // Qualquer devolução de sementes, movimento ou colheita fictícia falha:
        produto: { update: () => assert.fail("Estoque não deve ser alterado"), updateMany: () => assert.fail("Estoque não deve ser alterado") },
        move_estoque: { create: () => assert.fail("Não deve gerar movimento") },
      };
      try { return await funcao(tx); }
      catch (error) { desfazer.reverse().forEach((acao) => acao()); throw error; }
      finally { chamadas.push([id, "fim"]); liberar.reverse().forEach((acao) => acao()); }
    },
  };
  const api = carregar("app/api/plantios/encerrar/route.ts", {
    "@/app/lib/prisma": { prisma }, "@/app/lib/sessao": sessao,
    "@/app/lib/encerramento-cultivo": regras,
  }, { console: { error() {} } });
  return { api, prisma, estado, chamadas };
}

for (const [tipo, colheitas, modalidade] of [["NORMAL", 2, "NORMAL"], ["PERDA", 0, "PERDA_TOTAL"], ["PERDA", 2, "PERDA_REMANESCENTE"]]) {
  test(`${tipo} com ${colheitas} colheitas grava ${modalidade}, preservando histórico e responsável original`, async () => {
    const db = simular({ colheitas });
    const antes = structuredClone(db.estado);
    const resposta = await db.api.POST(request({ tipoEncerramento: tipo, modalidade: "NORMAL", id_usuario: 999 }));
    assert.equal(resposta.status, 200);
    assert.equal((await resposta.json()).modalidade, modalidade);
    assert.equal(db.estado.plantio.id_usuario, 5);
    assert.equal(db.estado.eventos[0].id_usuario, 8);
    assert.equal(db.estado.eventos[0].antes.status_plantio, "ATIVO");
    assert.equal(db.estado.eventos[0].depois.status_plantio, "CONCLUIDO");
    assert.equal(db.estado.eventos[0].antes.area_plantada, "1.25");
    assert.equal(db.estado.eventos[0].antes.quantidade_plantada, "5.50");
    assert.deepEqual(db.estado.plantio, { ...antes.plantio, status_plantio: "CONCLUIDO" });
    assert.equal(db.estado.colheitas, antes.colheitas);
    assert.deepEqual(db.estado.movimentos, antes.movimentos);
    assert.equal(db.estado.sementes, antes.sementes);
    assert.deepEqual(db.chamadas.filter((c) => c[1] === "bloqueio").map((c) => c[2]), ["lote", "plantio"]);
    assert.equal(db.chamadas[0][2].isolationLevel, "ReadCommitted");
  });
}
test("encerramento normal sem colheita não grava status/evento", async () => {
  const db = simular();
  assert.equal((await db.api.POST(request({ tipoEncerramento: "NORMAL" }))).status, 400);
  assert.equal(db.estado.plantio.status_plantio, "ATIVO");
  assert.equal(db.estado.eventos.length, 0);
});
for (const motivo of ["", "   ", "abcd", "x".repeat(1001), null]) {
  test(`motivo inválido (${String(motivo).length} caracteres) bloqueia ambos os tipos antes da transação`, async () => {
    for (const tipoEncerramento of ["NORMAL", "PERDA"]) {
      const db = simular();
      assert.equal((await db.api.POST(request({ motivo, tipoEncerramento }))).status, 400);
      assert.equal(db.chamadas.length, 0);
    }
  });
}
test("limite do motivo conta caracteres como o banco; trim é persistido", async () => {
  const db = simular();
  assert.equal((await db.api.POST(request({ motivo: `  ${"🌱".repeat(1000)}  ` }))).status, 200);
  assert.equal(Array.from(db.estado.eventos[0].motivo).length, 1000);
});
test("repetição idêntica retorna o mesmo evento sem modificar data/responsável", async () => {
  const db = simular();
  const primeira = await (await db.api.POST(request())).json();
  const antes = structuredClone(db.estado);
  const repeticao = await (await db.api.POST(request({ motivo: "  Perda por estiagem  " }))).json();
  assert.equal(repeticao.repetido, true);
  assert.equal(repeticao.idEvento, primeira.idEvento);
  assert.deepEqual(db.estado, antes);
});
test("repetição conflitante rejeita mudança de tipo ou motivo", async () => {
  const db = simular({ colheitas: 1 });
  await db.api.POST(request());
  const antes = structuredClone(db.estado);
  for (const extras of [{ tipoEncerramento: "NORMAL" }, { motivo: "Outro motivo" }]) {
    assert.equal((await db.api.POST(request(extras))).status, 409);
    assert.deepEqual(db.estado, antes);
  }
});
test("requisições concorrentes idênticas criam um único evento (bloqueios simulados)", async () => {
  const db = simular();
  const respostas = await Promise.all([db.api.POST(request()), db.api.POST(request())]);
  assert.deepEqual(respostas.map((r) => r.status), [200, 200]);
  const dados = await Promise.all(respostas.map((r) => r.json()));
  assert.deepEqual(dados.map((d) => d.repetido).sort(), [false, true]);
  assert.equal(db.estado.eventos.length, 1);
});
test("normal e perda concorrentes não sobrescrevem encerramento (bloqueios simulados)", async () => {
  const db = simular({ colheitas: 1 });
  const respostas = await Promise.all([db.api.POST(request({ tipoEncerramento: "NORMAL" })), db.api.POST(request())]);
  assert.deepEqual(respostas.map((r) => r.status).sort(), [200, 409]);
  assert.equal(db.estado.eventos.length, 1);
});
test("colheita concluída antes do bloqueio é considerada na modalidade", async () => {
  const db = simular({ aposBloqueio: async (estado) => { estado.colheitas = 1; } });
  assert.equal((await (await db.api.POST(request())).json()).modalidade, "PERDA_REMANESCENTE");
});
test("API de colheita rejeita nova colheita depois do encerramento", async () => {
  const db = simular();
  await db.api.POST(request());
  const antes = structuredClone(db.estado);
  const api = carregar("app/api/colheitas/route.ts", {
    "@/app/lib/prisma": { prisma: db.prisma }, "@/app/lib/sessao": sessao,
  });
  const resposta = await api.POST(new Request("http://teste.local/api/colheitas", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idPlantio: 1, idProdutoDestino: 9, data: "2025-01-02", quantidade: "1", unidade: "KG" }),
  }));
  assert.equal(resposta.status, 400);
  assert.match((await resposta.json()).error, /plantios ativos/);
  assert.deepEqual(db.estado, antes);
});
test("falha ao gravar evento desfaz mudança de status (rollback simulado)", async () => {
  const db = simular({ falharEvento: true });
  const antes = structuredClone(db.estado);
  assert.equal((await db.api.POST(request())).status, 500);
  assert.deepEqual(db.estado, antes);
});
test("conflito do índice único retorna 409 e desfaz status (simulado)", async () => {
  const db = simular({ falharEvento: "P2002" });
  const antes = structuredClone(db.estado);
  assert.equal((await db.api.POST(request())).status, 409);
  assert.deepEqual(db.estado, antes);
});
for (const status of ["CONCLUIDO", "CONCLUÍDO", "CANCELADO"]) {
  test(`status antigo ${status} sem evento permanece intacto`, async () => {
    const db = simular({ status });
    assert.equal((await db.api.POST(request())).status, 409);
    assert.equal(db.estado.plantio.status_plantio, status);
    assert.equal(db.estado.eventos.length, 0);
  });
}
test("vínculo do lote alterado durante espera é rejeitado após bloqueios", async () => {
  const db = simular({ aposBloqueio: async (estado) => { estado.plantio.id_lote = 99; } });
  assert.equal((await db.api.POST(request())).status, 409);
  assert.equal(db.estado.eventos.length, 0);
});
test("plantio inexistente responde 404", async () => {
  const db = simular({ semPlantio: true });
  assert.equal((await db.api.POST(request())).status, 404);
});
test("sessão inválida bloqueia antes de qualquer consulta/transação", async () => {
  const db = simular();
  const api = carregar("app/api/plantios/encerrar/route.ts", {
    "@/app/lib/prisma": { prisma: db.prisma },
    "@/app/lib/sessao": { ...sessao, exigirUsuario: async () => { throw new ErroAutenticacao(); } },
    "@/app/lib/encerramento-cultivo": regras,
  });
  assert.equal((await api.POST(request())).status, 401);
  assert.equal(db.chamadas.length, 0);
});
test("dados malformados, identificador ou tipo inválido não escrevem", async () => {
  const db = simular();
  for (const extras of [{ idPlantio: 0 }, { idPlantio: {} }, { tipoEncerramento: "PERDA_TOTAL" }]) {
    assert.equal((await db.api.POST(request(extras))).status, 400);
  }
  assert.equal((await db.api.POST(new Request("http://teste.local", { method: "POST", body: "{" }))).status, 400);
  assert.equal(db.chamadas.length, 0);
});

const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const jsxRuntime = { jsx, jsxs: jsx, Fragment: "fragment" };
function elementos(arvore) {
  if (Array.isArray(arvore)) return arvore.flatMap(elementos);
  if (!arvore || typeof arvore !== "object") return [];
  if (typeof arvore.type === "function") return elementos(arvore.type(arvore.props));
  return [arvore, ...elementos(arvore.props.children)];
}
function texto(arvore) {
  if (typeof arvore === "string" || typeof arvore === "number") return String(arvore);
  if (Array.isArray(arvore)) return arvore.map(texto).join(" ");
  if (!arvore || typeof arvore !== "object") return "";
  return texto(typeof arvore.type === "function" ? arvore.type(arvore.props) : arvore.props.children);
}
test("histórico exibe modalidade/motivo/ator/data e mantém leitura antiga sem inventar encerramento", async () => {
  const plantas = [
    { ...plantioBase(), status_plantio: "CONCLUIDO", evento_plantio: [{ id_evento: 10, modalidade: "PERDA_TOTAL", motivo: "Perda por estiagem", registrado_em: new Date("2026-10-01T15:00:00Z"), usuarios: { nome_usuario: "Responsável atual" } }] },
    { ...plantioBase(), id_plantio: 2, status_plantio: "CONCLUÍDO", evento_plantio: [] },
  ].map((p) => ({ ...p, cultura: { nome_cultura: "Milho" }, lote: { nome_lote: "Lote A" }, produto: { nome_produto: "Semente", unidade_medida: "KG" }, usuarios: { nome_usuario: "Responsável original" }, colheita: [], irrigacao: [], fertilizacao: [] }));
  const Page = carregar("app/(dashboard)/plantio/page.tsx", {
    "react/jsx-runtime": jsxRuntime, "next/navigation": { redirect: () => assert.fail("Redirect inesperado") },
    "@/app/lib/prisma": { prisma: { plantio: { findMany: async (args) => {
      assert.deepEqual(Object.keys(args.include.evento_plantio.select.usuarios.select), ["nome_usuario"]);
      return plantas;
    } }, lote: { findMany: async () => [] }, produto: { findMany: async () => [] } } },
    "@/app/lib/sessao": sessao, "@/app/lib/encerramento-cultivo": regras,
    "@/app/components/plantiomodal": { default: () => null, __esModule: true },
    "@/app/components/colheitamodal": { default: () => null, __esModule: true },
    "@/app/components/encerrar-cultivo": { default: () => null, __esModule: true },
    "@/app/components/cultivopainel": { __esModule: true, default: (props) => props.historico, DetalhesCultivo: (props) => props.children },
  }).default;
  const render = await Page();
  const conteudo = texto(render);
  for (const esperado of ["Encerramento por perda total", "Motivo:", "Perda por estiagem", "Responsável atual", "Responsável original", "01/10/2026", "12:00", "Brasília", "Sem evento de encerramento registrado", "CONCLUÍDO"]) {
    assert.ok(conteudo.includes(esperado), esperado);
  }
  const evento = elementos(render).find((e) => e.type === "li" && e.key === "encerramento-10");
  assert.ok(evento);
  assert.ok(!texto(evento).includes("0,00"), "encerramento não inventa quantidade");
});
function modal(estados, globais = {}, efeitos = []) {
  let id = 0;
  return carregar("app/components/encerrar-cultivo.tsx", {
    "react/jsx-runtime": jsxRuntime,
    react: { useId: () => `id-${++id}`, useRef: (valor) => ({ current: valor }), useState: () => [estados.shift(), () => {}], useEffect: (acao) => efeitos.push(acao) },
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/app/lib/encerramento-cultivo": regras,
  }, globais).default;
}
const props = { idPlantio: 1, nomeCultura: "Milho", possuiColheita: false, areaPlantada: "1,25" };
test("modal permite perda sem colheita; label e descrição estão associados e motivo vazio bloqueia envio", () => {
  const render = modal([true, false, "", "", "PERDA", ""])(props);
  const nos = elementos(render);
  const textarea = nos.find((e) => e.type === "textarea");
  assert.equal(nos.find((e) => e.type === "label").props.htmlFor, textarea.props.id);
  assert.ok(nos.some((e) => e.props.id === textarea.props["aria-describedby"]));
  const dialog = nos.find((e) => e.type === "dialog");
  assert.ok(nos.some((e) => e.props.id === dialog.props["aria-labelledby"]));
  assert.ok(nos.some((e) => e.props.id === dialog.props["aria-describedby"]));
  assert.equal(nos.find((e) => e.type === "button" && texto(e).includes("Encerrar normalmente")).props.disabled, true);
  assert.ok(!nos.find((e) => e.type === "button" && texto(e).includes("Encerrar por perda")).props.disabled);
  assert.equal(nos.find((e) => e.type === "button" && e.props.type === "submit").props.disabled, true);
  assert.ok(nos.some((e) => e.type === "svg"));
  assert.ok(texto(render).includes("Sementes utilizadas não retornam ao estoque"));
});
test("duplo envio do modal é bloqueado enquanto a primeira requisição está pendente", async () => {
  let resolver;
  let chamadas = 0;
  const pendente = new Promise((resolve) => { resolver = resolve; });
  const render = modal([true, false, "", "", "PERDA", "Perda por estiagem"], {
    fetch: async (_url, opcoes) => {
      chamadas++;
      assert.equal(JSON.parse(opcoes.body).tipoEncerramento, "PERDA");
      return pendente;
    },
  })(props);
  const form = elementos(render).find((e) => e.type === "form");
  const envio = form.props.onSubmit({ preventDefault() {} });
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(chamadas, 1);
  resolver(Response.json({ idEvento: 1, message: "Encerrado" }));
  await envio;
});
test("resposta inválida e falha de rede não travam o envio do modal", async () => {
  for (const falha of [async () => new Response("HTML", { status: 200 }), async () => { throw new Error("Falha de rede simulada"); }]) {
    let chamadas = 0;
    const render = modal([true, false, "", "", "PERDA", "Perda por estiagem"], { fetch: async () => { chamadas++; return falha(); } })(props);
    const form = elementos(render).find((e) => e.type === "form");
    await form.props.onSubmit({ preventDefault() {} });
    await form.props.onSubmit({ preventDefault() {} });
    assert.equal(chamadas, 2);
  }
});
