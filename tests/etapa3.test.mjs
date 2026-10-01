// Verificações de comportamento e estrutura com dependências simuladas.
// Não são validação visual, teste de navegador ou teste com banco.
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
    exports, Date, Intl, Error, Response, console,
    require(nome) { assert.ok(Object.hasOwn(dependencias, nome), `Importação real bloqueada: ${nome}`); return dependencias[nome]; },
    ...globais,
  }, { filename: arquivo });
  return exports;
}
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "fragment" };
const icone = carregar("app/components/ui-icon.tsx", { "react/jsx-runtime": runtime });
const data = carregar("app/lib/data-calendario.ts");
function nos(arvore) {
  if (Array.isArray(arvore)) return arvore.flatMap(nos);
  if (!arvore || typeof arvore !== "object") return [];
  if (typeof arvore.type === "function") return nos(arvore.type(arvore.props));
  return [arvore, ...nos(arvore.props.children)];
}

test("data máxima segue São Paulo quando UTC já está no dia seguinte", () => {
  assert.equal(data.dataEmSaoPaulo(new Date("2026-10-02T01:30:00Z")), "2026-10-01");
  assert.equal(data.dataEmSaoPaulo(new Date("2026-10-02T03:00:00Z")), "2026-10-02");
});

for (const permissao of ["PROPRIETARIO", "FUNCIONARIO"]) {
  test(`sidebar de ${permissao} contém apenas os links previstos`, () => {
    const estados = [true, false, ""];
    const Sidebar = carregar("app/components/sidebar.tsx", {
      "react/jsx-runtime": runtime,
      react: { useState: (inicial) => [estados.length ? estados.shift() : inicial, () => {}], useRef: (v) => ({ current: v }), useId: () => "nav", useEffect() {} },
      "next/link": { __esModule: true, default: "a" }, "next/navigation": { usePathname: () => "/perfil" },
    }).default;
    const links = nos(Sidebar({ usuario: { nome: "Nome muito longo", permissao } })).filter((n) => n.type === "a");
    assert.equal(links.filter((n) => n.props.href === "/perfil").length, 1);
    assert.equal(links.filter((n) => n.props.href === "/configuracoes").length, 0);
    for (const href of ["/dashboard", "/estoque", "/plantio", "/animais"]) assert.ok(links.some((n) => n.props.href === href));
    for (const href of ["/fazenda", "/usuarios"]) assert.equal(links.some((n) => n.props.href === href), permissao === "PROPRIETARIO");
    assert.equal(links.find((n) => n.props.href === "/perfil").props["aria-current"], "page");
  });
}

test("link antigo de Configurações vai ao Perfil; sem sessão vai ao login", async () => {
  for (const [usuario, destino] of [[{}, "/perfil"], [null, "/login"]]) {
    const Page = carregar("app/(dashboard)/configuracoes/page.tsx", {
      "@/app/lib/sessao": { obterUsuarioAtual: async () => usuario },
      "next/navigation": { redirect: (url) => { throw new Error(url); } },
    }).default;
    await assert.rejects(Page(), (erro) => erro.message === destino);
  }
});

const props = { lotes: [{ id_lote: 1, nome_lote: "Lote", area: 2 }], produtos: [{ id_produto: 2, nome_produto: "Semente", unidade_medida: "KG" }] };
function modal(estados, globais = {}) {
  const refs = [];
  const efeitos = [];
  const alteracoes = [];
  let indiceEstado = 0;
  let id = 0;
  const Modal = carregar("app/components/plantiomodal.tsx", {
    "react/jsx-runtime": runtime,
    react: {
      useState: () => { const indice = indiceEstado++; return [estados[indice], (valor) => alteracoes.push([indice, valor])]; },
      useRef: (v) => { const ref = { current: v }; refs.push(ref); return ref; },
      useId: () => `id-${++id}`, useEffect: (f) => efeitos.push(f),
    },
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/app/components/ui-icon": icone,
    "@/app/lib/data-calendario": data,
  }, { FormData: class { get(nome) { return { lote: "1", produto: "2", dataPlantio: "2026-10-01", quantidade: "1", areaPlantada: "1" }[nome] ?? ""; } }, ...globais }).default;
  return { Modal, refs, efeitos, alteracoes };
}
const aberto = [true, false, "", "1", "2", "2026-10-01"];

test("modal associa título/descrição/labels e mantém limites dos campos", () => {
  const { Modal } = modal(aberto);
  const elementos = nos(Modal(props));
  const dialog = elementos.find((n) => n.type === "dialog");
  for (const attr of ["aria-labelledby", "aria-describedby"]) assert.ok(elementos.some((n) => n.props.id === dialog.props[attr]));
  assert.equal(elementos.find((n) => n.props.name === "dataPlantio").props.max, "2026-10-01");
  assert.equal(elementos.find((n) => n.props.name === "areaPlantada").props.step, "0.01");
  assert.equal(elementos.filter((n) => n.type === "label").length, 6);
});

test("efeito abre diálogo nativo, foca lote e devolve foco ao botão (DOM simulado)", () => {
  const documento = { body: { style: { overflow: "auto" } } };
  const { Modal, refs, efeitos } = modal(aberto, { document: documento });
  Modal(props);
  const chamadas = [];
  refs[0].current = { open: false, showModal() { this.open = true; chamadas.push("abrir"); }, close() { this.open = false; chamadas.push("fechar"); } };
  refs[1].current = { isConnected: true, focus: () => chamadas.push("botao") };
  refs[2].current = { focus: () => chamadas.push("lote") };
  const limpar = efeitos[0]();
  assert.equal(documento.body.style.overflow, "hidden");
  limpar();
  assert.deepEqual(chamadas, ["abrir", "lote", "fechar", "botao"]);
  assert.equal(documento.body.style.overflow, "auto");
});

test("salvamento bloqueia duplo envio e fechamento por botão/Escape", async () => {
  let resolver;
  let envios = 0;
  const pendente = new Promise((resolve) => { resolver = resolve; });
  const { Modal, alteracoes } = modal(aberto, { fetch: async () => { envios++; return pendente; } });
  const elementos = nos(Modal(props));
  const form = elementos.find((n) => n.type === "form");
  const primeira = form.props.onSubmit({ preventDefault() {}, currentTarget: { reset() {} } });
  await form.props.onSubmit({ preventDefault() {} });
  elementos.find((n) => n.props["aria-label"] === "Fechar cadastro de plantio").props.onClick();
  elementos.find((n) => n.type === "dialog").props.onCancel({ preventDefault() {} });
  assert.equal(envios, 1);
  assert.ok(!alteracoes.some(([i, valor]) => i === 0 && valor === false));
  resolver(Response.json({ plantio: { id_plantio: 1 } }));
  await primeira;
  assert.ok(alteracoes.some(([i, valor]) => i === 0 && valor === false));
});

test("resposta inválida não fecha modal e permite tentar novamente", async () => {
  let chamadas = 0;
  const { Modal, alteracoes } = modal(aberto, { fetch: async () => { chamadas++; return new Response("HTML"); } });
  const form = nos(Modal(props)).find((n) => n.type === "form");
  for (let i = 0; i < 2; i++) await form.props.onSubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(chamadas, 2);
  assert.ok(!alteracoes.some(([i, valor]) => i === 0 && valor === false));
  assert.ok(alteracoes.some(([i, valor]) => i === 2 && valor.includes("Confira os plantios")));
});

test("sem lote ou semente não inicia cadastro", async () => {
  const { Modal } = modal(aberto, { fetch: () => assert.fail("Não deve enviar") });
  const elementos = nos(Modal({ lotes: [], produtos: [] }));
  assert.equal(elementos.find((n) => n.props.type === "submit").props.disabled, true);
  await elementos.find((n) => n.type === "form").props.onSubmit({ preventDefault() {} });
});
