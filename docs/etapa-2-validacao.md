# Etapa 2 — entrega e validação

> Relatório da etapa anterior. A implementação posterior dos encerramentos e a confirmação da tabela aplicada estão em `encerramento-cultivo-validacao.md`. A regularização permanece adiada; as verificações desta etapa anterior foram preservadas abaixo.

## Implementado (itens 1–4)

| Arquivo | Alteração |
| --- | --- |
| `app/lib/estoque-regras.ts` (novo) | Regra compartilhada `quantidade <= mínimo`, identificação de Dose, validação de inteiros e mensagens para cadastros/saldos antigos incompatíveis. |
| `app/(dashboard)/dashboard/page.tsx` | Usa a regra compartilhada e o texto “No mínimo ou abaixo”. |
| `app/components/estoque-painel.tsx` | Contagem, classificação e filtro incluem igualdade; filtro de alerta também inclui saldo zero/mínimo zero. Mantém identificação específica de “Sem estoque”. |
| `app/api/estoque/produtos/route.ts` | Vacina somente em Dose; quantidade inicial/mínimo inteiros em Dose para qualquer categoria. Bloqueio transacional PostgreSQL `(73142,5)` e comparação exata `lower(nome_produto) = lower(nome)` parametrizada, sob Read Committed explícito. Mantém mensagem amigável e HTTP 409 de duplicidade. |
| `app/api/estoque/movimentacoes/route.ts` | Bloqueia/reconsulta o produto antes de validar; impede frações em Dose e novas movimentações de cadastros antigos incompatíveis. Mantém proteção de saldo/limite e histórico. |
| `app/api/animais/vacinacoes/route.ts` | Lista vacinas compatíveis e informa as incompatíveis separadamente; POST também revalida saldo/mínimo inteiros. Preserva animal ativo, nascimento, data não futura, limite 1–999, saldo e histórico. |
| `app/api/animais/alimentacoes/route.ts` | Impede que alimentação em Dose contorne a regra de inteiros; informa/bloqueia legado incompatível. Mantém frações nas demais unidades e regras existentes. |
| `app/api/animais/route.ts` | Criação dentro de transação que bloqueia a espécie e revalida atividade antes de salvar. Upload permanece anterior à transação e foto nova é removida se o cadastro falhar. |
| `app/components/produtomodal.tsx` | Vacina oferece apenas Dose; validação e limites/passo de quantidade inicial/mínimo alinhados ao servidor. |
| `app/components/movimentacaomodal.tsx` | Passo inteiro em Dose, bloqueio de envio e aviso explícito de incompatibilidade; não mostra previsão de uma movimentação incompatível. |
| `app/components/animal-vacinacao.tsx` | Exibe motivos de indisponibilidade das vacinas antigas; não arredonda saldo para definir o máximo permitido. |
| `app/components/animal-alimentacao.tsx` | Passo/validação de inteiros em Dose e aviso/bloqueio de produto incompatível. |
| `tests/etapa2.test.mjs` (novo) | Testes isolados que executam os módulos reais das APIs/componentes com dependências simuladas. |

Nenhum cadastro antigo foi convertido de ML para Dose; saldos e mínimos não foram arredondados. Um saldo/mínimo fracionado em Dose ou vacina em outra unidade exige revisão do cadastro, sem correção automática nesta etapa.

## Caminhos de cadastro e bloqueios inspecionados

A busca no código da aplicação encontrou apenas `app/api/estoque/produtos/route.ts` criando produtos. Não há rota atual de renomeação. Plantio, colheita, alimentação, vacinação e movimentações manuais alteram somente saldos e utilizam bloqueios do produto. Qualquer futura criação/renomeação deve usar o mesmo advisory lock. Essa proteção cobre os caminhos atuais da aplicação; não cria um índice único nem protege escritas externas que ignorem o bloqueio.

`app/api/fazenda/especies/route.ts` já adquire `FOR UPDATE` na espécie antes de editar/desativar/excluir. O cadastro de animal agora adquire o mesmo bloqueio de linha e reconsulta a espécie dentro da transação. O upload não mantém bloqueio aberto.

## Verificações executadas

- `node_modules/.bin/tsc.cmd --noEmit --incremental false`: passou, sem erros.
- `npm.cmd run lint`: passou, sem erros ou avisos.
- `node --test tests/etapa2.test.mjs`: 29 testes passaram, zero falhas.
- `git diff --check`: passou.
- Comparação SHA-256 dos oito arquivos já modificados na etapa 1: todos preservados; `app/api/teste/route.ts` continua ausente. O git status foi conferido antes de editar.

Os testes cobrem igualdade/zero nos alertas, Dashboard/listagem, vacinação somente em Dose, frações no saldo inicial/mínimo/movimentos, limites/insuficiência, avisos e preservação de saldos antigos, duplicidade concorrente com variações de caixa, nomes com `%`/`_`, regras de vacinação, alimentação em Dose/KG, sessão inválida e espécie desativada após upload com limpeza da foto. Também verificam atributos/bloqueios de envio dos formulários por renderização simulada.

## Limites e pendências

Prisma, sessões, upload e bloqueios são simulados nos testes. Não há conexão com banco, upload real ou leitura de `.env`. O mutex usado nos testes é apenas uma simulação de teste; a aplicação usa bloqueios transacionais do PostgreSQL. Não foi instalado serviço, publicado projeto ou realizado push.

Ainda precisam de teste em banco isolado: advisory lock em conexões simultâneas (incluindo rollback e timeout), comparação de nomes na collation real, bloqueio de espécie concorrente com desativação/exclusão e garantias de rollback do Prisma. Também precisam de navegador: abertura/fechamento dos formulários, mensagens com respostas reais, validação nativa dos campos e upload/remoção real de imagem. Nenhum teste real com banco ou navegador foi executado. Build de produção não foi executado.

Os itens 5 e 6 permanecem propostas em `etapa-2-propostas-cultivo.md`. `sql/inspecao-cultivo.sql` prepara a inspeção somente leitura; `sql/proposta-eventos-plantio.sql` contém DDL aditiva para revisão, fora das migrations automáticas. Ambos não foram executados. `prisma/schema.prisma` e os dados/estrutura do banco permanecem sem alterações.
