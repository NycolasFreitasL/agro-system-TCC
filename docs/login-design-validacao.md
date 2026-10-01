# Login — design e usabilidade

## Resultado implementado

Login com composição de duas áreas a partir de 1024 px: apresentação AgroSystem em verde suave, frase curta e paisagem rural em SVG; formulário em superfície branca com título “Entrar no AgroSystem”. Em telas menores, a apresentação se reduz à marca e o formulário passa a ocupar uma coluna.

Foram preservados o nome AgroSystem e a paleta `#244b49`/`#486d6b`. Bordas, campos, foco e botões seguem a direção mais recente de Estoque. Não foi encontrada foto agro apropriada entre os assets do projeto; a paisagem é SVG nativo, sem biblioteca ou imagem externa. `img figma/Login.png` foi aberta e serviu como referência de marca/paleta, sem reprodução literal da composição ou adição dos controles/links daquela referência que não pertencem aos fluxos implementados.

O layout tem altura determinada pelo conteúdo, com altura mínima de viewport e rolagem normal da página. Não há altura fixa do formulário, transformação de escala ou ocultação do transbordamento. Campos têm fonte de 16 px, largura limitada ao contêiner, e botões têm área de toque de pelo menos 44 px. Isso foi inspecionado no código; o efeito real do teclado virtual/zoom ainda precisa de conferência.

Formulário:

- Labels E-mail/Senha associados aos inputs, com `autocomplete="username"` e `autocomplete="current-password"`.
- Mostrar/Ocultar senha com SVG, `type="button"`, nome acessível, estado e associação ao campo. Altera somente a visibilidade, mantendo a senha digitada.
- Botão Entrar/Entrando..., campos e alternância bloqueados durante envio.
- Erro junto aos campos dentro do formulário, anunciado por `role="alert"`; valores mantidos após falha.
- Foco visível, cores contrastantes e ícones decorativos ocultos de leitores de tela.

## Preservação e arquivos

O git status foi conferido antes da edição. Comparação de hashes confirmou que somente `app/login/page.tsx` foi alterado entre os arquivos existentes de app/Prisma/testes. Os estilos globais, Estoque, sidebar, APIs, sessão e demais módulos não mudaram nesta entrega.

Arquivos desta entrega:

- `app/login/page.tsx`: apresentação, formulário e alternância da senha.
- `app/login/login.module.css`: CSS novo, restrito ao login.
- `tests/login-design.test.mjs`: testes isolados de preservação do comportamento.
- Este relatório.

`handleSubmit` foi comparado com o conteúdo inicial e mantido integralmente: POST `/api/login`, payload `{ email, password }`, trim somente no e-mail, senha literal, validação existente, tratamento de rede/JSON/resposta inválida, bloqueio por ref e `router.replace("/dashboard")` seguido de refresh. Campos são obrigatórios; `noValidate` no formulário permite que o handler existente apresente as mensagens de validação junto ao formulário.

Não houve alteração de cookies, duração de sessão, usuário ativo/versão, permissões ou regras de segurança. Nenhuma operação no banco, instalação, publicação ou push foi realizada. Segredos do `.env` e credenciais reais não foram lidos/usados/exibidos. Senha não é registrada no console.

## Verificações executadas

- TypeScript: `node_modules/.bin/tsc.cmd --noEmit --incremental false` — passou.
- Lint: `npm.cmd run lint` — passou.
- `git diff --check` — passou.
- `node --test tests/login-design.test.mjs tests/estoque-design.test.mjs tests/etapa2.test.mjs tests/encerramento-cultivo.test.mjs tests/etapa3.test.mjs` — **97/97 passaram**, incluindo 14 testes novos de login.

Os 14 casos novos executam o componente com React/JSX, fetch e roteador simulados: labels/autocomplete, alternância com SVG sem envio/alteração dos valores, senha literal incluindo espaços, contrato POST/JSON, duplicidade/campos desabilitados, sucesso/redirecionamento, erro da API, sete formatos de resposta inválida, rede e nova tentativa mantendo os campos. Os 83 testes anteriores passaram como regressão. São testes de comportamento isolado; não exercitam autenticação/HTTP/banco reais nem validam o visual.

Verificação HTTP somente por GET: `/login` do servidor local existente retornou **200**, com o novo título/marca. Os dois assets CSS locais retornaram **200**, incluindo o módulo do login com a paleta solicitada. Nenhum formulário foi enviado, nenhuma credencial foi usada e o servidor existente foi preservado.

Resultado local consultável: **http://localhost:3000/login**.

## Limite de validação visual

Nenhuma ferramenta de navegador integrada ou conexão CDP funcional estava disponível. A execução Edge neste ambiente já havia falhado por acesso negado/processo de GPU, e a tentativa anterior fora do sandbox ficou sem confirmação e foi interrompida. Não foi repetida uma tentativa demorada nesta entrega.

**Não houve teste visual ou captura do novo login.** GET/HTML/CSS e testes com dependências simuladas não validam aparência, foco real, zoom ou teclado virtual. As larguras 320, 375, 768 e 1440 px, janela baixa e zoom de 200% continuam pendentes no navegador.

## Roteiro curto de conferência manual

1. Abrir `/login` em **320, 375, 768 e 1440 px**, janela baixa e zoom real de 200%. Conferir a composição, texto, ausência de rolagem horizontal e acesso ao botão Entrar com teclado virtual aberto. A apresentação completa deve aparecer no desktop; nos tamanhos menores, somente a marca.
2. Usar Tab/Shift+Tab: E-mail → Senha → Mostrar/Ocultar senha → Entrar. Conferir foco visível, labels e alternância sem envio. Usar somente valores fictícios ao produzir capturas; não mostrar senhas reais.
3. Em ambiente de teste identificado, conferir erros de campo, rede/resposta inválida, manutenção do conteúdo, duplo clique/Enter durante envio e estado Entrando.... Confirmar sucesso/redirecionamento e regras de sessão com conta de teste. A API/autenticação real não foi exercitada pelo agente.
