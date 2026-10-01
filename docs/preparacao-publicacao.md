# Preparação e verificação técnica de publicação

Verificação de 01/10/2026, em Windows, Node 24.18.0 e npm 11.16.0.
As alterações existentes foram preservadas. Nenhum SQL, migration, reset,
`db push`, publicação ou push foi executado. Segredos não foram exibidos.

## Resultado das verificações

| Verificação executada | Resultado | Limite da evidência |
| --- | --- | --- |
| Git status antes das alterações | Conferido; havia alterações de etapas anteriores | Não foi feito checkout, descarte ou commit |
| `npm.cmd run lint` | Passou | Análise estática |
| `npm.cmd run typecheck` | Passou | TypeScript sem emissão; executado também após o build |
| `npm.cmd test` | 97/97 passaram | Prisma, sessão, bloqueios, React/DOM, rede e uploads simulados |
| `npm.cmd run prisma:validate` | Schema válido | Configuração de geração sem conexão; não verifica o catálogo PostgreSQL |
| Build de produção antes e depois da correção | Passou com Turbopack, incluindo TypeScript | Não valida credenciais, acesso ao banco ou regras na hospedagem |
| Instalação limpa anterior, `npm.cmd ci --offline --no-audit --no-fund` | Instalou 524 pacotes, mas não gerou o client | Problema reproduzido em pasta temporária sem client nem `.env` |
| Instalação limpa após a correção, mesmo comando | Passou e gerou Prisma Client 7.9.0 no `postinstall` | Sem `.env` copiado; confirmou importação do client e modelo `evento_plantio` |
| Build na cópia limpa, sem `.env` | Passou | Prova do empacotamento nessa máquina, não de acesso ao PostgreSQL |
| HTTP real local do servidor de produção | 37 verificações passaram | Sem cookies/credenciais; sem navegador e sem operações autenticadas |

A primeira tentativa da instalação corrigida encontrou `EPERM` no cache
global do Prisma, fora do diretório permitido pelo sandbox. A repetição com
permissão passou. Isso era uma restrição do ambiente de verificação.
O npm emitiu aviso sobre scripts de instalação de dependências ainda sem
entradas `allowScripts`; o comando passou. Se a hospedagem exigir uma lista
de aprovação, revisar os scripts de `@prisma/engines`, `bcrypt`, `prisma`,
`sharp` e `unrs-resolver` nas versões do lock, sem liberar scripts globalmente.
A instalação de conferência usou o cache local e não executou auditoria de
vulnerabilidades das dependências.

O teste HTTP usou somente a cópia limpa em `127.0.0.1:3041`, com as variáveis
de banco, sessão, setup e Cloudinary vazias no processo temporário. O servidor
foi encerrado ao concluir. Resultados:

- `/login`: 200; Dashboard, Estoque, Cultivo, Animais, Fazenda, Usuários,
  Perfil e Configurações: 307 para `/login`, sem sessão.
- Todos os 25 métodos existentes das APIs protegidas, incluindo sessão,
  leituras operacionais, cadastro/alteração de usuários, Fazenda e uploads:
  401 sem sessão. Requisições de escrita enviaram apenas `{}` e foram recusadas
  pela autenticação antes de consultas, transações ou processamento de fotos.
- `/api/teste`: 404; configuração inicial sem chave habilitada: 403; login
  com objeto vazio: 400. Não houve autenticação com senha ou criação de conta.

O roteiro HTTP inicial incluiu GET em uma API que só implementa POST/PATCH;
o 405 era o comportamento correto. A lista foi corrigida a partir dos métodos
exportados pelo código e reexecutada integralmente. Nenhuma API foi alterada
para atender a um método inexistente.

## Correções realizadas

- `package.json`: `postinstall` e `prebuild` executam `prisma:generate` com
  `prisma/generate.config.ts`. Essa configuração não importa dotenv nem
  configura conexão. O client continua gerado e ignorado no Git.
- Scripts `prisma:validate`, `typecheck` e `test` tornam os checks reproduzíveis.
  O lint continua separado do build, conforme o comportamento do Next 16.
- Faixa de Node compatível com Prisma/Next declarada em `engines`.
- `dotenv` passou a ser dependência direta, pois `prisma.config.ts` o importa.
  A versão 17.4.2 já estava no lock; nenhuma versão de pacote foi atualizada.
- `package-lock.json` sincronizado; README substituído por instruções reais.

Nenhuma regra de negócio, autenticação, CSS ou componente foi alterado nesta
verificação. Não foram editados arquivos gerados manualmente ou desativadas
regras de lint/tipos para passar.

## Instalação e build reproduzíveis

Usar uma versão de Node na faixa do `engines`; a verificação usou 24.18.0.
A hospedagem precisa executar Next com servidor/API e runtime Node.js,
incluindo bcrypt, Prisma e `pg`; uma exportação estática não atende ao projeto.
Incluir dependências de desenvolvimento durante o build.

```sh
npm ci --include=dev
npm run prisma:validate
npm run lint
npm run typecheck
npm test
npm run build
```

`npm ci` gera o client via `postinstall`. Se scripts forem bloqueados pela
política do ambiente, executar `npm run prisma:generate` antes de `typecheck`;
`npm run build` também gera novamente pelo `prebuild`. Uma instalação com
cache de dependências deve continuar executando o `prebuild`. Copiar o schema,
a configuração de geração e o client gerado para o artefato correspondente.
Validar o build também no sistema operacional da hospedagem.

Prisma generate/validate não criam nem alteram tabelas. O caminho de geração
não depende da configuração CLI de banco em `prisma.config.ts`.
Após preparar ambiente e banco, `npm start` sobe o servidor de produção.
Não houve publicação nesta verificação.

## Preparação do banco: procedimento pendente, não executado

**Banco existente informado pelo usuário:** schema `public`, sem CHECK de
status em plantio, contagens de vínculos ausentes iguais a zero e SQL de
`evento_plantio` aplicado com sucesso. Essas informações são fornecidas pelo
usuário; não foram reconferidas por conexão ao banco nesta verificação.

1. Identificar o banco e a credencial que a hospedagem realmente utilizará.
   Conferir `public`/search_path, tabelas, colunas, CHECKs, FKs, defaults e
   privilégios com o responsável pelo banco. Não repetir o SQL aplicado.
2. Confirmar `evento_plantio`, suas restrições e o índice
   `uq_evento_encerramento`: UNIQUE de `id_plantio` somente quando
   `tipo = 'ENCERRAMENTO'`. Ele permanece no SQL versionado em
   `sql/proposta-eventos-plantio.sql`; não há `@unique` geral no Prisma.
   `prisma validate` não comprova que esse índice existe no PostgreSQL.
3. Revisar grants da credencial da aplicação, incluindo objetos auxiliares e
   privilégios necessários para transações/bloqueios. Eventos precisam de
   SELECT/INSERT; não disponibilizar UPDATE/DELETE de eventos à aplicação.
   Evitar credencial proprietária/superusuária. Não atribuir grants sem
   conhecer os papéis e políticas do ambiente.
4. Preparar backup/recuperação e testar a conexão, TLS e pooling compatíveis
   com transações/bloqueios na hospedagem antes de liberar o uso.

**PostgreSQL novo:** não existem `prisma/migrations`, baseline, seed ou DDL
completo versionados. `migrate deploy` não é um procedimento suficiente
para criar esse banco. Obter exportação confiável da estrutura real ou uma
baseline revisada que preserve CHECKs, índices parciais, FKs, defaults e
eventuais triggers/políticas. Validar sua aplicação em banco isolado antes
de qualquer execução autorizada no alvo. Não gerar a baseline apenas do
modelo Prisma, que não representa todas essas restrições. Qualquer futura
marcação de migrations como aplicadas também altera metadados do banco.

Um banco novo precisa de catálogo de culturas reais: não há seed nem API
de cadastro de culturas. Sementes/plantios exigem seus vínculos. Planejar
importação aprovada desses dados, sem inventar registros. Fazenda permite
administrar dados, lotes e espécies; o proprietário tem fluxo próprio abaixo.
Regularização de plantios antigos continua adiada conforme a inspeção
informada pelo usuário.

## Implementado e dependente da hospedagem

| Assunto | Implementado no código | Pendência operacional |
| --- | --- | --- |
| Autenticação | Senha literal; bcrypt; usuário ativo; revalidação da versão da sessão; JWT de 8h; cookie HttpOnly/Secure em produção/SameSite Lax | HTTPS; `SESSION_SECRET` aleatória de pelo menos 64 caracteres, estável entre instâncias; sessões reais ainda não testadas |
| Permissões | Fazenda/Usuários exigem proprietário nas páginas e APIs; operações exigem sessão; desativação e troca de senha invalidam sessões | Testar proprietário/funcionário e revogação em sessões reais |
| Tentativas de login | Bloqueio de envio duplicado somente no formulário | **Bloqueador antes de exposição pública:** limitação persistente/distribuída em proxy/WAF ou backend compartilhado; não há quota/429 no servidor atual |
| Configuração inicial | `SETUP_SECRET` >=64, comparação temporal segura, validação antes de consultas, advisory lock e recusa de segundo proprietário | Habilitar chave temporariamente somente se ainda não houver proprietário; concluir bootstrap controlado; remover de todas as instâncias/reiniciar e bloquear API no proxy |
| PostgreSQL | Client e schema compatíveis estaticamente com o SQL de eventos informado | `DATABASE_URL`, estrutura/grants reais, backup, TLS/pooling e testes de transação |
| Uploads | Validações de tamanho/tipo/assinatura, envio Cloudinary e limpeza em falhas | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`; conectividade, limites do proxy e testes de envio/limpeza |

Não usar prefixo `NEXT_PUBLIC_` para essas variáveis, nem registrar seus
valores em logs/relatórios. O build passar sem `.env` não comprova que a
configuração de execução esteja correta. Valores reais não foram inspecionados.

Para login, definir e testar janela/quota/recuperação apropriadas ao ambiente;
proteger o endpoint em todas as instâncias, responder à limitação de forma
clara e impedir que o endereço direto contorne o proxy. Confiar no IP de
origem somente conforme a cadeia de proxies controlada. Também limitar
payloads e abuso no setup, quando temporariamente habilitado. O projeto não
recebeu um limitador em memória como solução de produção.

Sem `SETUP_SECRET`, a API de cadastro inicial já responde 403. Se o banco
atual já tiver proprietário, manter o cadastro inicial desabilitado; não
criar outro. A existência real desse usuário não foi consultada aqui.

## Roteiro curto dos testes reais ainda necessários

Executar em ambiente de homologação isolado, com dados e contas de teste
autorizados. Esses testes escrevem dados de teste e não foram realizados aqui.

1. **Permissões e segurança:** proprietário acessa Fazenda/Usuários;
   funcionário recebe 403 nas APIs administrativas; sem sessão recebe 401.
   Conferir cookies em HTTPS, logout, expiração, troca de senha, desativação
   e reativação sem recuperar sessões antigas. Testar quota entre instâncias,
   recuperação e impossibilidade de contornar o proxy. Em banco isolado,
   testar duas tentativas concorrentes de bootstrap e desabilitar setup depois.
2. **Estoque:** mesmo alerta no Dashboard/listagem/filtro quando saldo <=
   mínimo; Dose inteira no servidor; vacina somente em Dose; legado incompatível
   bloqueado sem arredondamento. Testar saldo insuficiente, histórico,
   alimentação/vacinação e cadastros concorrentes com nomes de caixas diferentes.
3. **Encerramento normal:** sem colheita ou motivo é recusado; com colheita,
   status e evento são gravados juntos e área é liberada. Confirmar ator/data
   reais, repetição sem duplicação e conflito sem sobrescrita.
4. **Perda e concorrência:** sem colheita gera PERDA_TOTAL; após colheita
   parcial gera PERDA_REMANESCENTE. Conferir lote → plantio em conexões reais,
   colheita/encerramento simultâneos, índice parcial e rollback de falha no evento.
5. **Histórico:** comparar responsável original, colheitas, movimentos e
   sementes antes/depois. Não deve haver devolução, colheita ou movimento
   fictício. Encerramentos antigos sem evento permanecem legíveis sem
   modalidade/motivo/responsável/data inventados.
6. **Uploads e navegador:** foto válida de Animal (até 2 MB) e Perfil (até
   4 MB), assinatura/tipo/tamanho inválidos, erro de rede, falha ao salvar e
   remoção da imagem nova; espécie desativada durante cadastro. Conferir
   modais, foco, teclado e layout no navegador. A aprovação visual do usuário
   foi preservada; esta verificação não realizou testes visuais.
