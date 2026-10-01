// Comportamento isolado com React, JSX, fetch e roteador simulados.
// Não executa a API, navegador ou banco e não valida o resultado visual.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "fragment" };
const css = new Proxy({}, { get: (_target, name) => String(name) });

function elementos(arvore) {
  if (Array.isArray(arvore)) return arvore.flatMap(elementos);
  if (!arvore || typeof arvore !== "object") return [];
  if (typeof arvore.type === "function") return elementos(arvore.type(arvore.props));
  return [arvore, ...elementos(arvore.props.children)];
}

function texto(arvore) {
  if (Array.isArray(arvore)) return arvore.map(texto).join(" ");
  if (arvore === null || arvore === undefined || typeof arvore === "boolean") return "";
  if (typeof arvore !== "object") return String(arvore);
  if (typeof arvore.type === "function") return texto(arvore.type(arvore.props));
  return texto(arvore.props.children);
}

function harness({ estados = [], fetch = async () => Response.json({ message: "Login realizado." }) } = {}) {
  const valores = [...estados];
  const refs = [];
  const navegacao = [];
  let indiceEstado = 0;
  let indiceRef = 0;
  const dependencias = {
    "react/jsx-runtime": runtime,
    "./login.module.css": { __esModule: true, default: css },
    "next/navigation": {
      useRouter: () => ({
        replace(caminho) { navegacao.push(["replace", caminho]); },
        refresh() { navegacao.push(["refresh"]); },
      }),
    },
    react: {
      useId: () => "login-campos",
      useRef(inicial) { const i = indiceRef++; refs[i] ??= { current: inicial }; return refs[i]; },
      useState(inicial) {
        const i = indiceEstado++;
        if (i >= valores.length) valores[i] = inicial;
        return [valores[i], (valor) => { valores[i] = typeof valor === "function" ? valor(valores[i]) : valor; }];
      },
    },
  };
  const arquivo = "app/login/page.tsx";
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${arquivo}`, import.meta.url), "utf8"), {
    fileName: arquivo,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, Error, fetch,
    require(nome) { assert.ok(Object.hasOwn(dependencias, nome), `Importação real bloqueada: ${nome}`); return dependencias[nome]; },
  }, { filename: arquivo });
  return {
    valores,
    navegacao,
    render() {
      indiceEstado = 0; indiceRef = 0;
      const arvore = exports.default();
      return { arvore, nos: elementos(arvore) };
    },
    async enviar() {
      const form = this.render().nos.find((n) => n.type === "form");
      await form.props.onSubmit({ preventDefault() {} });
    },
  };
}

const credenciais = ["  exemplo@agrosystem.test  ", "  senha com espaços  ", "", false, false];
function campos(h) {
  const { nos } = h.render();
  return {
    nos,
    email: nos.find((n) => n.type === "input" && n.props.name === "email"),
    senha: nos.find((n) => n.type === "input" && n.props.name === "password"),
    formulario: nos.find((n) => n.type === "form"),
    entrar: nos.find((n) => n.type === "button" && n.props.type === "submit"),
  };
}

test("login associa labels e autocomplete aos campos e oferece apenas ações implementadas", () => {
  const h = harness();
  const { nos, email, senha, entrar } = campos(h);
  for (const [campo, esperado] of [[email, "E-mail"], [senha, "Senha"]]) {
    const label = nos.find((n) => n.type === "label" && n.props.htmlFor === campo.props.id);
    assert.ok(label && texto(label).includes(esperado));
  }
  assert.notEqual(email.props.id, senha.props.id);
  assert.equal(email.props.type, "email");
  assert.equal(email.props.autoComplete, "username");
  assert.equal(senha.props.type, "password");
  assert.equal(senha.props.autoComplete, "current-password");
  assert.equal(texto(entrar).trim(), "Entrar");
  assert.ok(nos.some((n) => n.type === "h1" && texto(n).trim() === "Entrar no AgroSystem"));
  const conteudo = texto(h.render().arvore);
  for (const proibido of ["Criar conta", "Esqueci minha senha", "Lembrar de mim"]) assert.ok(!conteudo.includes(proibido));
});

test("mostrar/ocultar senha tem SVG, nome acessível e não envia o formulário nem modifica os valores", () => {
  let chamadas = 0;
  const h = harness({ estados: credenciais, fetch: async () => { chamadas++; return Response.json({ message: "Login realizado." }); } });
  const antes = campos(h);
  const mostrar = antes.nos.find((n) => n.type === "button" && n.props["aria-label"] === "Mostrar senha");
  assert.ok(mostrar);
  assert.equal(mostrar.props.type, "button");
  assert.equal(mostrar.props["aria-pressed"], false);
  assert.ok(elementos(mostrar).some((n) => n.type === "svg"));
  mostrar.props.onClick();
  const aberto = campos(h);
  assert.equal(aberto.senha.props.type, "text");
  assert.equal(aberto.senha.props.value, credenciais[1]);
  assert.equal(aberto.email.props.value, credenciais[0]);
  const ocultar = aberto.nos.find((n) => n.type === "button" && n.props["aria-label"] === "Ocultar senha");
  assert.equal(ocultar.props["aria-pressed"], true);
  assert.equal(ocultar.props.type, "button");
  ocultar.props.onClick();
  assert.equal(campos(h).senha.props.type, "password");
  assert.equal(chamadas, 0);
});

test("envio mantém POST/JSON da API e transmite a senha literalmente; sucesso redireciona e mantém bloqueio", async () => {
  const requisicoes = [];
  const h = harness({ estados: credenciais, fetch: async (url, init) => { requisicoes.push({ url, init }); return Response.json({ message: "Login realizado." }); } });
  await h.enviar();
  assert.equal(requisicoes.length, 1);
  assert.equal(requisicoes[0].url, "/api/login");
  assert.equal(requisicoes[0].init.method, "POST");
  assert.equal(requisicoes[0].init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(requisicoes[0].init.body), { email: "exemplo@agrosystem.test", password: "  senha com espaços  " });
  assert.deepEqual(h.navegacao, [["replace", "/dashboard"], ["refresh"]]);
  assert.equal(campos(h).entrar.props.disabled, true);
  await h.enviar();
  assert.equal(requisicoes.length, 1);
});

test("envio pendente impede duplicidade e desabilita campos enquanto informa Entrando...", async () => {
  let resolver;
  let chamadas = 0;
  const pendente = new Promise((resolve) => { resolver = resolve; });
  const h = harness({ estados: credenciais, fetch: () => { chamadas++; return pendente; } });
  const primeira = h.enviar();
  await h.enviar();
  assert.equal(chamadas, 1);
  const durante = campos(h);
  assert.equal(durante.formulario.props["aria-busy"], true);
  assert.equal(durante.email.props.disabled, true);
  assert.equal(durante.senha.props.disabled, true);
  assert.equal(durante.entrar.props.disabled, true);
  assert.equal(texto(durante.entrar).trim(), "Entrando...");
  resolver(Response.json({ message: "Login realizado." }));
  await primeira;
});

test("erro da API é associado ao formulário, preserva credenciais e permite nova tentativa", async () => {
  let chamadas = 0;
  const h = harness({ estados: credenciais, fetch: async () => {
    chamadas++;
    return chamadas === 1 ? Response.json({ error: "Credenciais inválidas." }, { status: 401 }) : Response.json({ message: "Login realizado." });
  } });
  await h.enviar();
  const depois = campos(h);
  const alerta = depois.nos.find((n) => n.props.role === "alert");
  assert.ok(alerta);
  assert.ok(texto(alerta).includes("Credenciais inválidas."));
  assert.ok(depois.formulario.props["aria-describedby"].split(/\s+/).includes(alerta.props.id));
  assert.equal(depois.email.props.value, credenciais[0]);
  assert.equal(depois.senha.props.value, credenciais[1]);
  assert.equal(depois.entrar.props.disabled, false);
  assert.deepEqual(h.navegacao, []);
  await h.enviar();
  assert.equal(chamadas, 2);
  assert.deepEqual(h.navegacao, [["replace", "/dashboard"], ["refresh"]]);
});

for (const [nome, response] of [
  ["conteúdo HTML", () => new Response("<html></html>", { headers: { "content-type": "text/html" } })],
  ["JSON malformado", () => new Response("{", { headers: { "content-type": "application/json" } })],
  ["JSON nulo", () => Response.json(null)],
  ["array JSON", () => Response.json([])],
  ["objeto sem mensagem", () => Response.json({})],
  ["mensagem vazia", () => Response.json({ message: "   " })],
  ["sucesso contendo error", () => Response.json({ message: "Login realizado.", error: "erro" })],
]) {
  test(`resposta inválida (${nome}) exibe erro, libera nova tentativa e mantém os campos`, async () => {
    const h = harness({ estados: credenciais, fetch: async () => response() });
    await h.enviar();
    const depois = campos(h);
    assert.ok(texto(depois.nos.find((n) => n.props.role === "alert")).includes("resposta inválida"));
    assert.equal(depois.email.props.value, credenciais[0]);
    assert.equal(depois.senha.props.value, credenciais[1]);
    assert.equal(depois.entrar.props.disabled, false);
    assert.deepEqual(h.navegacao, []);
  });
}

test("falha de rede gera mensagem clara e permite repetir sem apagar credenciais", async () => {
  let chamadas = 0;
  const h = harness({ estados: credenciais, fetch: async () => {
    chamadas++;
    if (chamadas === 1) throw new TypeError("fetch failed");
    return Response.json({ message: "Login realizado." });
  } });
  await h.enviar();
  const depois = campos(h);
  assert.ok(texto(depois.nos.find((n) => n.props.role === "alert")).includes("Não foi possível conectar ao servidor"));
  assert.equal(depois.email.props.value, credenciais[0]);
  assert.equal(depois.senha.props.value, credenciais[1]);
  assert.equal(depois.entrar.props.disabled, false);
  await h.enviar();
  assert.equal(chamadas, 2);
  assert.deepEqual(h.navegacao, [["replace", "/dashboard"], ["refresh"]]);
});

test("campos editados alimentam o envio sem transformar senha formada apenas por espaços", async () => {
  let corpo;
  const h = harness({ fetch: async (_url, init) => { corpo = JSON.parse(init.body); return Response.json({ message: "Login realizado." }); } });
  const inicial = campos(h);
  inicial.email.props.onChange({ target: { value: "usuario@agrosystem.test" } });
  inicial.senha.props.onChange({ target: { value: "   " } });
  await h.enviar();
  assert.deepEqual(corpo, { email: "usuario@agrosystem.test", password: "   " });
});

