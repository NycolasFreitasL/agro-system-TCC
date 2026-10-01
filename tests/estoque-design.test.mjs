// Testes isolados de comportamento com React, JSX e DOM simulados.
// Não são validação visual, execução em navegador nem teste com banco.
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
    exports, Date, Intl, Error, Response, AbortController, console,
    require(nome) { assert.ok(Object.hasOwn(dependencias, nome), `Importação real bloqueada: ${nome}`); return dependencias[nome]; },
    ...globais,
  }, { filename: arquivo });
  return exports;
}
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "fragment" };
const icone = carregar("app/components/ui-icon.tsx", { "react/jsx-runtime": runtime });
const regras = carregar("app/lib/estoque-regras.ts");
function nos(arvore) {
  if (Array.isArray(arvore)) return arvore.flatMap(nos);
  if (!arvore || typeof arvore !== "object") return [];
  if (typeof arvore.type === "function") return nos(arvore.type(arvore.props));
  return [arvore, ...nos(arvore.props.children)];
}
function texto(arvore) {
  if (Array.isArray(arvore)) return arvore.map(texto).join(" ");
  if (arvore === null || arvore === undefined || typeof arvore === "boolean") return "";
  if (typeof arvore !== "object") return String(arvore);
  if (typeof arvore.type === "function") return texto(arvore.type(arvore.props));
  return texto(arvore.props.children);
}

function harness(arquivo, { estados = [], globais = {}, dependencias = {} } = {}) {
  const valores = [...estados];
  const refs = [];
  let indiceEstado = 0;
  let indiceRef = 0;
  let indiceId = 0;
  let efeitos = [];
  const Componente = carregar(`app/components/${arquivo}.tsx`, {
    "react/jsx-runtime": runtime,
    react: {
      useState(inicial) {
        const i = indiceEstado++;
        if (i >= valores.length) valores[i] = inicial;
        return [valores[i], (valor) => { valores[i] = typeof valor === "function" ? valor(valores[i]) : valor; }];
      },
      useRef(inicial) { const i = indiceRef++; refs[i] ??= { current: inicial }; return refs[i]; },
      useId: () => `estoque-id-${++indiceId}`,
      useEffect: (efeito) => efeitos.push(efeito),
      useMemo: (calcular) => calcular(),
    },
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/app/lib/estoque-regras": regras,
    "@/app/components/ui-icon": icone,
    ...dependencias,
  }, globais).default;
  return {
    render(props) {
      indiceEstado = 0; indiceRef = 0; indiceId = 0; efeitos = [];
      const arvore = Componente(props);
      return { arvore, elementos: nos(arvore), efeitos };
    },
    valores,
  };
}
const produtos = [
  { id_produto: 101, nome_produto: "Café Arábica", categoria: "Semente", quantidade: 3, estoque_min: 2, unidade_medida: "KG", id_cultura: 5, culturaNome: "Café" },
  { id_produto: 102, nome_produto: "Vacina A", categoria: "Vacina", quantidade: 2, estoque_min: 2, unidade_medida: "Dose", id_cultura: null, culturaNome: null },
  { id_produto: 103, nome_produto: "Milho colhido", categoria: "Outro", quantidade: 0, estoque_min: 0, unidade_medida: "KG", id_cultura: 4, culturaNome: "Milho" },
  { id_produto: 104, nome_produto: "Desinfetante", categoria: "Outro", quantidade: 0, estoque_min: 1, unidade_medida: "L", id_cultura: null, culturaNome: null },
  { id_produto: 105, nome_produto: "Vitamina", categoria: "Alimentação", quantidade: 5, estoque_min: 1, unidade_medida: "Dose", id_cultura: null, culturaNome: null },
];
const props = { produtos, movimentacoes: [], movimentacoesHoje: 7 };
function painel() {
  return harness("estoque-painel", { dependencias: {
    "@/app/components/produtomodal": { __esModule: true, default: () => null },
    "@/app/components/movimentacaomodal": { __esModule: true, default: () => null },
  } });
}
const ids = ({ elementos }) => elementos.filter((n) => n.type === "tr" && n.key !== undefined).map((n) => n.key);
function abrirFiltros(h) {
  const { elementos } = h.render(props);
  elementos.find((n) => n.type === "button" && n.props["aria-controls"]).props.onClick();
}
function selecionar(h, titulo, valor) {
  const { elementos } = h.render(props);
  const label = elementos.find((n) => n.type === "label" && texto(n).includes(titulo));
  assert.ok(label, `Label de ${titulo} deve estar disponível`);
  const select = nos(label).find((n) => n.type === "select");
  select.props.onChange({ target: { value: valor } });
}

test("busca aceita nome sem acento, cultura e código; preserva os dados recebidos", () => {
  const copia = structuredClone(produtos);
  const h = painel();
  for (const [busca, esperados] of [["ARABICA", [101]], [" café ", [101]], ["103", [103]], ["milho", [103]]]) {
    h.render(props).elementos.find((n) => n.type === "input" && n.props.type === "search").props.onChange({ target: { value: busca } });
    assert.deepEqual(ids(h.render(props)), esperados);
  }
  assert.deepEqual(produtos, copia);
});

test("filtro de alerta inclui igualdade e saldo zero com mínimo zero", () => {
  const h = painel();
  abrirFiltros(h);
  selecionar(h, "Situação", "BAIXO");
  assert.deepEqual(ids(h.render(props)), [102, 103, 104]);
  selecionar(h, "Situação", "SEM_ESTOQUE");
  assert.deepEqual(ids(h.render(props)), [103, 104]);
  selecionar(h, "Situação", "NORMAL");
  assert.deepEqual(ids(h.render(props)), [101, 105]);
});

test("categoria Produto colhido preserva a classificação de legado Outro/KG/cultura", () => {
  const h = painel();
  abrirFiltros(h);
  selecionar(h, "Categoria", "Produto colhido");
  assert.deepEqual(ids(h.render(props)), [103]);
  selecionar(h, "Categoria", "Outro");
  selecionar(h, "Situação", "BAIXO");
  assert.deepEqual(ids(h.render(props)), [104]);
});

test("filtros ativos continuam visíveis e podem ser limpos com painel recolhido", () => {
  const h = painel();
  abrirFiltros(h);
  selecionar(h, "Categoria", "Vacina");
  selecionar(h, "Situação", "BAIXO");
  const antes = h.render(props);
  const alternar = antes.elementos.find((n) => n.type === "button" && n.props["aria-controls"]);
  assert.ok(texto(alternar).includes("Filtros"));
  assert.ok(texto(alternar).includes("2"), "o botão informa quantos filtros de seleção estão ativos");
  alternar.props.onClick();
  const recolhido = h.render(props);
  assert.deepEqual(ids(recolhido), [102]);
  assert.equal(recolhido.elementos.find((n) => n.type === "button" && n.props["aria-controls"]).props["aria-expanded"], false);
  const limpar = recolhido.elementos.find((n) => n.type === "button" && texto(n).includes("Limpar filtros"));
  assert.ok(limpar, "limpar permanece disponível sem reabrir os filtros");
  limpar.props.onClick();
  assert.deepEqual(ids(h.render(props)), produtos.map((p) => p.id_produto));
});

test("estoque vazio e pesquisa sem resultados oferecem mensagens distintas", () => {
  const h = painel();
  const vazio = h.render({ ...props, produtos: [] });
  assert.ok(texto(vazio.arvore).includes("Seu estoque ainda está vazio"));
  const preenchido = h.render(props);
  preenchido.elementos.find((n) => n.type === "input" && n.props.type === "search").props.onChange({ target: { value: "inexistente" } });
  const semResultado = h.render(props);
  assert.ok(texto(semResultado.arvore).includes("Nenhum produto encontrado"));
  assert.ok(texto(semResultado.arvore).match(/0\s+de\s+5/));
  const limpar = semResultado.elementos.find((n) => n.type === "button" && texto(n).includes("Limpar"));
  limpar.props.onClick();
  assert.deepEqual(ids(h.render(props)), produtos.map((p) => p.id_produto));
});

test("situação tem texto e a listagem não sugere capacidade percentual", () => {
  const { arvore, elementos } = painel().render(props);
  const conteudo = texto(arvore);
  for (const esperado of ["No mínimo ou abaixo", "Sem estoque", "Normal"]) assert.ok(conteudo.includes(esperado));
  assert.ok(!conteudo.includes("% do mínimo"));
  assert.ok(!conteudo.includes("Valor em estoque"));
  assert.ok(!elementos.some((n) => n.type === "th" && texto(n).trim() === "Nível"));
});

test("busca possui label e tabela é uma região acessível para rolagem por teclado", () => {
  const { elementos } = painel().render(props);
  const search = elementos.find((n) => n.type === "input" && n.props.type === "search");
  const label = elementos.find((n) => n.type === "label" && (n.props.htmlFor === search.props.id || nos(n).includes(search)));
  assert.ok(label && texto(label).includes("Buscar"));
  const tabela = elementos.find((n) => n.props.role === "region" && nos(n).some((e) => e.type === "table"));
  assert.equal(tabela.props.tabIndex, 0);
  assert.ok(tabela.props["aria-label"]);
});

test("histórico mantém tipo, responsável, observação e horário de Brasília", () => {
  const { arvore } = painel().render({ ...props, movimentacoes: [{ id: 9, produto: "Café Arábica", tipo: "SAÍDA", quantidade: 1.5, unidade: "KG", data: "2026-10-02T01:30:00Z", responsavel: "Ana Responsável", observacao: "Uso registrado anteriormente" }] });
  const conteudo = texto(arvore);
  for (const esperado of ["Saída", "1,50", "Ana Responsável", "Uso registrado anteriormente", "01/10/2026", "22:30"]) assert.ok(conteudo.includes(esperado));
});

const produtoDose = { id_produto: 1, nome_produto: "Vacina A", categoria: "Vacina", quantidade: 10, estoque_min: 2, unidade_medida: "Dose" };
const produtoEstados = [true, false, "", "Vacina", "DOSE", [], false, ""];
const movimentoEstados = [true, false, "", "1", "SAIDA", "2", "Uso previsto"];
function documentoSimulado() { return { body: { style: { overflow: "auto" } } }; }
function formularioSimulado() {
  return { resetado: false, valores: { nome: "Vacina A", quantidade: "2", estoqueMinimo: "1", idCultura: "" }, reset() { this.resetado = true; } };
}
const FormDataSimulado = class { constructor(form) { this.form = form; } get(nome) { return this.form.valores[nome] ?? ""; } };

for (const [arquivo, estados, modalProps, campo] of [
  ["produtomodal", produtoEstados, undefined, "nome"],
  ["movimentacaomodal", movimentoEstados, { produtos: [produtoDose] }, "produto"],
  ["movimentacaomodal", movimentoEstados, { idProduto: 1, nomeProduto: "Vacina A", quantidadeAtual: 10, unidadeMedida: "Dose", categoria: "Vacina", estoqueMinimo: 2 }, "quantidade"],
]) {
  test(`${arquivo}/${campo}: abertura e retorno de foco são coordenados (DOM simulado)`, () => {
    const document = documentoSimulado();
    const h = harness(arquivo, { estados, globais: { document } });
    const { elementos, efeitos } = h.render(modalProps);
    const dialog = elementos.find((n) => n.type === "dialog");
    const origem = elementos.find((n) => n.type === "button");
    const primeira = campo === "nome"
      ? elementos.find((n) => n.props.name === "nome")
      : elementos.find((n) => n.type === (campo === "produto" ? "select" : "input"));
    assert.ok(primeira.props.ref, "campo de foco inicial possui referência");
    const chamadas = [];
    dialog.props.ref.current = { open: false, showModal() { this.open = true; chamadas.push("abrir"); }, close() { this.open = false; chamadas.push("fechar"); } };
    origem.props.ref.current = { isConnected: true, focus() { chamadas.push("origem"); } };
    primeira.props.ref.current = { focus() { chamadas.push(campo); } };
    const limpar = efeitos[0]();
    assert.equal(document.body.style.overflow, "hidden");
    limpar();
    assert.deepEqual(chamadas, ["abrir", campo, "fechar", "origem"]);
    assert.equal(document.body.style.overflow, "auto");
    for (const attr of ["aria-labelledby", "aria-describedby"]) assert.ok(elementos.some((n) => n.props.id === dialog.props[attr]));
  });
}

for (const [arquivo, estados, modalProps] of [
  ["produtomodal", produtoEstados, undefined],
  ["movimentacaomodal", movimentoEstados, { produtos: [produtoDose] }],
]) {
  test(`${arquivo}: salvamento impede envio duplicado, botão e Escape`, async () => {
    let resolver;
    let chamadas = 0;
    const pendente = new Promise((resolve) => { resolver = resolve; });
    const h = harness(arquivo, { estados, globais: { FormData: FormDataSimulado, fetch: () => { chamadas++; return pendente; } } });
    const { elementos } = h.render(modalProps);
    const form = elementos.find((n) => n.type === "form");
    const formulario = formularioSimulado();
    const salvar = form.props.onSubmit({ preventDefault() {}, currentTarget: formulario });
    await form.props.onSubmit({ preventDefault() {}, currentTarget: formulario });
    elementos.find((n) => n.type === "button" && n.props["aria-label"]?.includes("Fechar")).props.onClick();
    elementos.find((n) => n.type === "dialog").props.onCancel({ preventDefault() {} });
    assert.equal(chamadas, 1);
    assert.equal(h.valores[0], true);
    assert.equal(h.render(modalProps).elementos.find((n) => n.type === "fieldset").props.disabled, true);
    resolver(Response.json({ sucesso: true }, { status: 201 }));
    await salvar;
    assert.equal(h.valores[0], false);
  });

  test(`${arquivo}: erro mantém dados e modal aberto para correção`, async () => {
    const h = harness(arquivo, { estados, globais: { FormData: FormDataSimulado, fetch: async () => Response.json({ error: "Confira os dados informados." }, { status: 400 }) } });
    const formulario = formularioSimulado();
    const valoresAntes = structuredClone(formulario.valores);
    await h.render(modalProps).elementos.find((n) => n.type === "form").props.onSubmit({ preventDefault() {}, currentTarget: formulario });
    assert.equal(h.valores[0], true);
    assert.equal(h.valores[1], false);
    assert.equal(h.valores[2], "Confira os dados informados.");
    assert.equal(formulario.resetado, false);
    assert.deepEqual(formulario.valores, valoresAntes);
    if (arquivo === "movimentacaomodal") assert.deepEqual(h.valores.slice(3), movimentoEstados.slice(3));
  });
}

test("prévia de saldo mantém entrada/saída sem gravação e respeita Dose inteira", () => {
  const h = harness("movimentacaomodal", { estados: movimentoEstados });
  const modalProps = { produtos: [produtoDose] };
  const saida = h.render(modalProps);
  assert.ok(texto(saida.arvore).includes("8,00 dose"));
  const entrada = saida.elementos.find((n) => n.type === "button" && texto(n).trim() === "Entrada");
  entrada.props.onClick();
  assert.ok(texto(h.render(modalProps).arvore).includes("12,00 dose"));
  const campoQuantidade = h.render(modalProps).elementos.find((n) => n.type === "input" && n.props.type === "number");
  assert.equal(campoQuantidade.props.step, "1");
  campoQuantidade.props.onChange({ target: { value: "0.5" } });
  assert.equal(h.render(modalProps).elementos.find((n) => n.props.type === "submit").props.disabled, true);
});
