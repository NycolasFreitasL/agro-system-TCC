# Etapa 2 — propostas para revisão (itens 5 e 6)

> Atualização: o usuário confirmou schema public, tabela de eventos aplicada e contagens zero de plantios com área/cultura ausentes nas categorias inspecionadas. O encerramento foi implementado conforme `encerramento-cultivo-validacao.md`; a regularização permanece adiada. O texto abaixo registra a proposta original, anterior à aplicação confirmada.

Os itens 1–4 foram implementados no código. Este documento e os SQLs em `docs/sql/` são propostas: não foram aplicados ao banco nem implementados na interface. Nenhum dado atual foi consultado. Não se presume a existência de plantios antigos incompletos.

## Evidência disponível e limites

- `prisma/schema.prisma`: `plantio.status_plantio` é varchar(20); `id_cultura` e `area_plantada` são opcionais. A área usa decimal(10,2). Existem usuário do cadastro, lote, semente e datas, mas não há motivo, responsável/data de encerramento ou tabela de auditoria do cultivo.
- O schema avisa sobre CHECKs que o Prisma não representa. Não há migrations SQL versionadas disponíveis no projeto. Portanto, os valores permitidos pelo CHECK de status e eventuais triggers/índices no banco real ainda precisam ser conferidos.
- `app/api/plantios/encerrar/route.ts`: bloqueia o plantio, exige colheita e grava `CONCLUIDO`. Reconhece também `CONCLUÍDO` ao ler registros antigos.
- `app/api/plantios/route.ts` e `app/api/fazenda/lotes/route.ts`: bloqueiam o lote e consideram `ATIVO`/`EM ANDAMENTO` na ocupação; novos plantios são bloqueados se houver área ativa desconhecida.
- `app/api/colheitas/route.ts`: bloqueia o plantio; colheitas e entradas de produto são registradas separadamente. Sementes foram consumidas no cadastro do plantio.

Antes de aprovar DDL, revisar o resultado de `sql/inspecao-cultivo.sql` com acesso somente de leitura. O arquivo está preparado, mas não foi executado.

## 5. Encerramento por perda

Proposta: aproveitar `CONCLUIDO`, após confirmar sua aceitação pelo banco, e registrar o tipo de encerramento em uma nova tabela `evento_plantio`. Não introduzir status `PERDIDO` sem conhecer os CHECKs. Na interface, mostrar “Encerrado por perda total” ou “Encerrado por perda do restante”, obtidos do evento. Não classificar perda como sucesso nos textos/indicadores.

Em Cultivo, ação “Encerrar por perda” abre um modal com histórico de colheitas, área a liberar, motivo obrigatório (5–1000 caracteres após trim) e aviso de que sementes consumidas não retornam ao estoque. A API determina a modalidade sob bloqueio: sem colheitas = `PERDA_TOTAL`; com qualquer colheita = `PERDA_REMANESCENTE`. Não pede estimativa fictícia de quantidade perdida ou colheita zero. Manter o acesso atual de encerramento para usuários autenticados ativos; a regularização abaixo é exclusiva do proprietário.

Fluxo transacional proposto:

1. Validar sessão antes das consultas. Descobrir lote do plantio e bloquear lote → plantio; revalidar o vínculo e status após os bloqueios. Usar Read Committed explícito. Essa ordem coordena com cadastro/alteração de lote e regularização; a colheita já bloqueia plantio antes do produto e não deve adquirir lote depois desses bloqueios.
2. Aceitar somente `ATIVO`/`EM ANDAMENTO`; ler colheitas dentro da transação. Se já concluído, devolver o encerramento existente sem inserir outro evento; rejeitar pedido conflitante. Cultivos antigos concluídos sem evento continuam sem metadados, sem inventar responsável/data.
3. Atualizar somente status para `CONCLUIDO` e inserir evento `ENCERRAMENTO` com modalidade, motivo, id do usuário autenticado e timestamp do banco, além de snapshots antes/depois. O id do responsável não vem do formulário. Falha em qualquer escrita desfaz ambas.
4. Não inserir colheita, movimentação de estoque ou devolução de sementes. Preservar todas as colheitas parciais e movimentos já existentes. A área deixa de ocupar o lote pelos critérios existentes de status.
5. O encerramento normal existente também deve inserir evento `NORMAL`, preservando sua exigência de pelo menos uma colheita. Repetições não duplicam registros (índice único de encerramento por plantio).

Histórico visível no detalhe do cultivo: modalidade, motivo, responsável e data/hora de Brasília. Sem endpoints de exclusão/edição de eventos. Preservar usuário original do plantio e datas originais. Se a área já estiver ausente, mostrar “Área não informada”; fechar por perda ainda pode retirar o plantio da ocupação desconhecida, sem atribuir área.

## 6. Regularização de plantios sem área/cultura

Proposta: ação “Regularizar cadastro” apenas para proprietário, somente nos registros com `area_plantada IS NULL` ou `id_cultura IS NULL`. Se não houver registros assim, não exibir aviso. Não criar carga de preenchimento automático ou apagar registros.

Modal mostra os campos originais e colheitas, permite informar apenas os campos ausentes e exige justificativa (5–1000 caracteres). Exibir a área conhecida ocupada, capacidade do lote e eventuais outros plantios ativos com área desconhecida. O proprietário informa a área efetivamente utilizada; não assumir a área integral do lote. Não permitir trocar lote, semente, datas, responsável original ou campos já preenchidos neste fluxo.

Validações propostas no servidor:

- `exigirProprietario()` antes das consultas; revalidar permissão/atividade no início da transação para evitar confiar em estado antigo da tela.
- Bloquear lote → plantio → produtos vinculados (ids em ordem crescente). Reconsultar vínculos/status antes de atualizar. Coordenar também com encerramento/colheita e administração do lote. Mudança concorrente exige recarregar o formulário.
- Área real positiva, até duas casas, dentro do decimal(10,2). Para plantio ativo, lote deve estar ativo e a soma das áreas dos outros ativos, excluindo o próprio, mais a área informada não pode exceder a área do lote.
- Se outros ativos tiverem área desconhecida, rejeitar uma regularização individual que alegue disponibilidade não comprovada. Oferecer um formulário conjunto, ainda exclusivo do proprietário, para preencher todas as áreas ausentes daquele lote: uma transação bloqueia o lote e os plantios por id, valida a soma total e registra um evento por plantio. Não liberar novos plantios enquanto houver ocupação desconhecida.
- Para plantio concluído, a área é histórica e não entra na ocupação atual; validar área positiva e não maior que a capacidade do lote. Se a capacidade histórica divergir da atual, não forçar valor falso: exigir revisão específica fora desta regularização simples.
- Cultura deve existir; para plantio ativo, estar ativa. Deve concordar com a cultura da semente, quando disponível, e com produtos de destino de todas as colheitas que tenham cultura vinculada. Vínculos contraditórios bloqueiam e mostram quais registros precisam de revisão. Semente sem vínculo não autoriza inferir cultura: exigir seleção e justificativa do proprietário. Preservar produtos/histórico; não alterar automaticamente a cultura da semente.
- Preencher só campos ausentes; inserir evento `REGULARIZACAO` com motivo, usuário atual, timestamp e snapshots antes/depois na mesma transação. Repetição após regularização devolve conflito sem sobrescrever dados. Nenhuma alteração de saldo ou colheita.

Não se recalculam previsões automaticamente: preservar datas existentes e mostrar que estimativas dependem da cultura/área regularizadas.

## Persistência proposta e ordem de aplicação

`sql/proposta-eventos-plantio.sql` é DDL aditivo para revisão, fora de `prisma/migrations`, sem execução automática. Cria apenas a tabela de eventos, FKs que impedem apagar plantios/usuários referenciados, validações do motivo/modalidade e índice único de encerramento. Snapshots JSONB guardam os valores relevantes anteriores e posteriores, serializando decimais como texto; não devem incluir informações de autenticação. Não copia ou inventa eventos para registros antigos.

Ordem proposta:

1. Revisar catálogo real (schema/search_path, CHECKs, triggers, FKs, índices, políticas, isolamento e permissões) com o SQL de inspeção; validar tipos e nomes contra o ambiente alvo. Não executar a proposta se houver estrutura conflitante.
2. Definir baseline/versionamento das migrations existentes com o responsável pelo banco, sem reset/db push. Aprovar a DDL aditiva e revisá-la em cópia isolada. Se o CHECK rejeitar `CONCLUIDO`, suspender e preparar uma alteração explícita separada após conhecer sua definição; não substituir CHECK às cegas.
3. Aplicar a migration aditiva aprovada no banco antes de publicar código que depende dela. Depois representar `evento_plantio` e suas relações no Prisma e regenerar cliente. Nada disso foi feito nesta etapa.
4. Implementar APIs, histórico e modais aprovados; validar transações e permissões. Manter leitura de encerramentos antigos sem evento e status acentuado. A versão anterior da aplicação ignora a nova tabela, mas voltar a ela interromperia a auditoria de novos encerramentos; rollback de código exige suspender essas ações.
5. Testar em banco isolado: perda total/parcial sem movimentação, motivo obrigatório, dupla submissão, colheita simultânea, encerramento/regularização/cadastro simultâneos no mesmo lote, regularização conjunta, funcionário proibido, capacidade excedida, cultura conflitante, rollback e preservação de histórico. Testar modais em navegador. Esses testes estão pendentes.

Não há alteração no schema Prisma, migração aplicada ou dados corrigidos nesta entrega. As propostas 5 e 6 precisam de revisão antes de implementação.
