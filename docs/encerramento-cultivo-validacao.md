# Encerramento normal e por perda — entrega

## Implementação

`evento_plantio` foi representado no Prisma com os nomes/tipos do SQL confirmado pelo usuário: integer/identity, varchar, JSONB e timestamp com fuso, usando `clock_timestamp()` para a data. As relações usam `fk_evento_plantio` e `fk_evento_usuario`, com exclusão restrita. O índice de histórico foi mapeado. **Não há unicidade geral em id_plantio**: o índice `uq_evento_encerramento` continua no SQL aplicado, com `WHERE tipo = 'ENCERRAMENTO'`, assim como os CHECKs. Nenhum DDL foi executado nesta implementação.

A API recebe `{ idPlantio, tipoEncerramento: "NORMAL" | "PERDA", motivo }`. Normal exige pelo menos uma colheita. Perda determina `PERDA_TOTAL` quando não há colheitas ou `PERDA_REMANESCENTE` quando há. Motivo é obrigatório, após trim, com 5–1000 caracteres. O responsável vem da sessão, e a data do default no banco; campos enviados pelo cliente não os substituem.

A transação Read Committed localiza o lote, bloqueia **lote → plantio** e reconsulta vínculo/status. Isso coordena com cadastro e administração de lotes. Colheitas usam o mesmo bloqueio de plantio e não adquirem lote depois dele; seu fluxo foi preservado. A API altera somente status para `CONCLUIDO` e insere o evento com snapshots antes/depois (decimais em texto), na mesma transação.

Repetição com mesmo tipo e motivo normalizado devolve HTTP 200, o id original e `repetido: true`, sem duplicar evento ou substituir responsável/data. Tipo ou motivo diferente retorna 409. Colheitas não são recontadas para reclassificar um evento já persistido. A proteção do índice parcial também é preservada; conflito de unicidade retorna 409 e a transação falha integralmente.

Cultivos antigos `CONCLUIDO`/`CONCLUÍDO` sem evento continuam legíveis, com aviso explícito de que os metadados do encerramento não foram informados. Tentativa de encerrá-los novamente recebe 409; não cria evento retroativo. Responsável original do plantio, colheitas, sementes e movimentos não são alterados. Novas colheitas são bloqueadas pelo status existente.

O modal oferece encerramento normal e por perda, mostra área e contexto das colheitas, exige motivo e informa a preservação de sementes consumidas/histórico. Usa dialog nativo, foco inicial no motivo, labels associados, descrição acessível, Escape/cancelamento, prevenção de duplo envio, SVGs e cores `#486d6b`/`#244b49`. Confirmação/cancelamento são bloqueados durante o envio. A resposta inválida não é tratada como sucesso.

O histórico geral e o histórico por cultivo exibem modalidade, motivo, responsável pelo encerramento e data/hora de Brasília, sem quantidade fictícia. O responsável pelo plantio permanece identificado separadamente.

## Arquivos desta implementação

- `prisma/schema.prisma`: modelo e relações da tabela já aplicada.
- `prisma/generate.config.ts`: configuração de geração/validação local sem dotenv ou datasource.
- `app/api/plantios/encerrar/route.ts`: regras, bloqueios, atomicidade e repetição/conflito.
- `app/lib/encerramento-cultivo.ts`: modalidades, nomes e validação compartilhada de motivo.
- `app/components/encerrar-cultivo.tsx`: modal responsivo de encerramento.
- `app/(dashboard)/plantio/page.tsx`: consulta e exibição dos eventos/histórico, mantendo a sessão antes das consultas e selects limitados de usuário.
- `docs/sql/proposta-eventos-plantio.sql`: cabeçalho atualizado para registrar a confirmação de aplicação pelo usuário; DDL/índice parcial preservados, incluindo `SET LOCAL search_path TO public`.
- `tests/encerramento-cultivo.test.mjs`: testes novos isolados.
- `docs/etapa-2-propostas-cultivo.md` e `docs/etapa-2-validacao.md`: notas que apontam para esta entrega, preservando os relatórios anteriores.
- Este documento. O client em `app/generated/prisma` foi regenerado pelo CLI, sem edição manual.

## Verificações e limites

Geração e validação Prisma passaram com `--config prisma/generate.config.ts`, sem carregar `.env` nem acessar o banco. TypeScript (`--noEmit --incremental false`), lint e `git diff --check` passaram.

Os testes executam os módulos reais, mas usam sessão, Prisma, relógio do evento, mutex e rollback simulados. Cobrem normal/perda total/perda remanescente, motivo/limites, sessão, ordem dos bloqueios, campos preservados, motivo/responsável/data, repetição, concorrência entre pedidos iguais/conflitantes, atualização do lote durante espera, colheita anterior ao bloqueio, bloqueio de nova colheita após encerramento, falha de gravação, conflito do índice e renderização do histórico/modal. São 29 testes novos, além dos 29 da etapa 2: **58 passaram**.

**Testes reais com banco ou navegador realizados pelo agente: nenhum.** A inspeção do banco e a aplicação da tabela foram informadas pelo usuário; não são verificações executadas pelo agente. Bloqueios reais em conexões diferentes, CHECKs/default/FKs/índice na tabela aplicada, rollback real e acessibilidade/responsividade no navegador continuam pendentes de teste manual. Build de produção não executado.

A regularização foi adiada: nenhuma API, formulário ou carga de regularização foi implementada. As contagens informadas pelo usuário são zero nas categorias inspecionadas. Não foram executados novos SQLs, reset, db push, publicação ou push.

## Roteiro manual (pendente)

Usar ambiente de teste com a tabela já aplicada e cultivos de teste. Não repetir o DDL.

1. Entrar com funcionário ativo e proprietário. Em um cultivo sem colheita, confirmar que o botão normal está indisponível e o de perda abre. Tentar motivo vazio, somente espaços, 4 caracteres e mais de 1000: não deve salvar. Pela API, normal sem colheita deve retornar 400.
2. Registrar uma colheita legítima em outro cultivo de teste, anotar saldos/histórico e encerrar normalmente com motivo. Conferir `CONCLUIDO`, modalidade normal, área livre, motivo, usuário atual e hora de Brasília. O responsável original e os saldos devem permanecer como estavam após a colheita.
3. Encerrar por perda um cultivo sem colheitas. Conferir perda total e liberação de área, sem nova colheita, entrada de sementes ou movimento de estoque.
4. Em cultivo com colheita parcial, encerrar por perda. Conferir perda do restante e preservação de todas as colheitas/movimentos anteriores. Não deve estimar nem registrar quantidade perdida.
5. Reenviar exatamente o mesmo pedido (mesmo tipo/motivo) pelo navegador/ferramenta HTTP: 200 com id original e `repetido: true`. Alterar motivo ou tipo: 409. Conferir que o histórico continua com um encerramento e mantém responsável/data originais. Duplo clique durante envio deve enviar uma vez.
6. Em duas sessões independentes, disputar normal/perda e colheita/encerramento no mesmo cultivo. O primeiro commit determina o resultado: colheita antes do encerramento entra na modalidade; encerramento antes da colheita bloqueia a colheita. Nenhum evento duplicado ou alteração parcial deve aparecer. Disputar encerramento e novo plantio no mesmo lote: a área só fica disponível após commit.
7. Tentar nova colheita após encerramento: deve ser rejeitada. Abrir um encerramento antigo sem evento: o status e o responsável original aparecem, sem motivo/data/ator de encerramento inventados.
8. Em teste controlado separado, simular falha de gravação/permissão de INSERT de evento e conferir rollback do status. Não mudar permissões do banco de produção para este teste.
9. Testar modal e histórico em 320, 375 e 768 px e desktop; motivo longo/múltiplas linhas; navegação por Tab/Shift+Tab, foco inicial no motivo, Escape, retorno de foco ao botão e anúncio de erros. Conferir ausência de rolagem horizontal. Com rede indisponível/resposta inválida, o formulário deve liberar nova tentativa e orientar a conferir histórico quando o resultado for desconhecido.
