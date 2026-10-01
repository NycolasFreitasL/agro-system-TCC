# Etapa 3 — design, navegação e responsividade

## Mudanças aplicadas

O git status foi conferido antes das edições. As alterações já presentes foram mantidas. Comparação de hashes antes/depois confirmou que as APIs, os helpers anteriores de negócio/sessão, o schema Prisma e a configuração de geração não foram modificados nesta etapa. A suíte anterior de testes recebeu somente a dependência do novo componente SVG no carregador simulado.

- Sidebar: Principal com Dashboard, Estoque, Cultivo e Animais; Administração com Fazenda e Usuários apenas para proprietário; foto/nome no rodapé abrem Perfil, ao lado do fluxo existente de Sair. Perfil e Configurações não aparecem como itens repetidos. Menu móvel mantém Escape e retorno ao botão. Há atalho de teclado para pular ao conteúdo.
- `/configuracoes` permanece como rota autenticada que redireciona para `/perfil`. O retorno de Usuários aponta para Dashboard. As verificações de sessão/proprietário nas páginas e nas APIs foram preservadas.
- Paleta principal `#486d6b` e `#244b49`, campos compartilhados, títulos, foco visível, desabilitados, mensagens e estados vazios. Cores de erro, alerta e sucesso foram mantidas. Botões de adicionar/fechar usam SVG, com texto ou nome acessível.
- Estoque: removido o card sem funcionalidade “Valor em estoque”; os três indicadores restantes ocupam uma grade responsiva. Nenhum cálculo de estoque foi alterado.
- Layout: conteúdo com largura limitada e `min-width: 0`; nomes longos quebram dentro de cards/detalhes; ações e abas podem reorganizar-se; tabelas mantêm a rolagem no próprio contêiner, agora focável e identificado. Fotos existentes mantêm tamanho limitado e recorte.
- Modal de plantio: `dialog.showModal()` fornece o comportamento modal nativo; foco inicial no lote, Escape, retorno ao botão, bloqueio de fechamento/envio enquanto salva, rolagem vertical e rodapé empilhado no celular. Labels envolvem os campos. A data máxima é calculada em `America/Sao_Paulo` ao abrir, conforme a API. Falha de rede/resposta inválida mantém o formulário aberto e libera nova tentativa; resposta inesperada orienta conferir os plantios antes de repetir.

Nenhuma imagem do Figma foi encontrada nas imagens do projeto ou anexada à conversa. Foi usado o padrão visual existente; não houve comparação com Figma.

## Arquivos desta etapa

Navegação e base visual:

- `app/components/sidebar.tsx`
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/configuracoes/page.tsx`
- `app/(dashboard)/usuarios/page.tsx`
- `app/globals.css`
- `app/components/ui-icon.tsx` (novo)

Páginas e componentes ajustados, preservando os fluxos:

- `app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/fazenda/page.tsx`, `app/(dashboard)/plantio/page.tsx`
- `app/components/estoque-painel.tsx`, `produtomodal.tsx`, `movimentacaomodal.tsx`
- `app/components/plantiomodal.tsx`, `colheitamodal.tsx`, `cultivopainel.tsx`, `productionChart.tsx`
- `app/components/animais-painel.tsx`, `animalmodal.tsx`, `animal-alimentacao.tsx`, `animal-vacinacao.tsx`, `animal-historico.tsx`
- `app/components/fazenda-formulario.tsx`, `fazenda-lotes.tsx`, `fazenda-especies.tsx`
- `app/components/perfil-formulario.tsx`, `usuarios-painel.tsx`
- `app/lib/data-calendario.ts` (novo, somente formatação de data)
- `tests/etapa3.test.mjs` (novo), `tests/etapa2.test.mjs` (dependência SVG no carregador)
- Este documento.

Outros arquivos que já estavam modificados no git status pertencem às etapas anteriores; não são mudanças desta entrega.

## Verificações executadas

- TypeScript: `node_modules/.bin/tsc.cmd --noEmit --incremental false` — passou.
- Lint: `npm.cmd run lint` — passou, sem avisos/erros.
- `node --test tests/etapa2.test.mjs tests/encerramento-cultivo.test.mjs tests/etapa3.test.mjs` — **67 testes passaram** (29 estoque/animais, 29 encerramento, 9 desta etapa).
- `git diff --check` — passou.

Os testes são isolados e executam os módulos com dependências simuladas: sessão, Prisma, requisições e DOM. Os novos casos cobrem links por perfil, redirecionamento legado, data de São Paulo, associação de campos/título/descrição, chamadas de foco do diálogo, prevenção de envio duplicado/fechamento durante envio, resposta inválida e ausência de lote/semente. **Não validam layout renderizado, contenção real de foco, leitores de tela nem bloqueios PostgreSQL.**

Uma requisição HTTP sem autenticação ao Dashboard do servidor local existente terminou em `/login`. Isso apenas confirma aquele redirecionamento; não valida login, permissões de proprietário ou visual das telas internas. Nenhum navegador integrado ou sessão autenticada estava disponível para essa conferência. **Nenhuma tela foi testada visualmente no navegador pelo agente.**

Não foram executadas operações de escrita no banco, novos SQLs, reset, db push, publicação ou push. Nenhum segredo do `.env` foi lido/exibido. Build de produção não foi executado.

## Revisão estática e conferência visual pendente

Os breakpoints/classes foram revisados no código considerando as cinco larguras solicitadas. As observações abaixo são inspeção de código, não medições no navegador.

| Área | Ajustes/revisão pelo código | 320, 375, 768, 1024 e 1440 px no navegador |
| --- | --- | --- |
| Sidebar | Menu móvel abaixo de 768; largura de 240 px a partir de 768; navegação com rolagem vertical; nome truncado com título | Pendente |
| Dashboard | Cards em 1/2/4 colunas, gráfico responsivo e tabela com rolagem interna | Pendente |
| Estoque | Indicadores em 1/2/3 colunas; cards móveis e tabela a partir de 1024; filtros com espaço para SVG | Pendente |
| Cultivo | Cards em grade; abas reorganizáveis; detalhes em coluna nas telas pequenas; modal de 92vw limitado a 90dvh | Pendente |
| Animais | Indicadores em 1/2/3 colunas; cards móveis, tabela a partir de 1024; fotos e histórico com largura limitada | Pendente |
| Fazenda | Campos em 1/2 colunas; ações com quebra; mensagens/nomes longos | Pendente |
| Perfil | Formulários em 1/2 colunas; foto/upload em coluna no celular; botões e campos limitados | Pendente |
| Usuários | Campos em 1/2 colunas; lista em coluna no celular; nome/e-mail com quebra | Pendente |

## Roteiro curto de conferência visual

Usar contas e registros de um ambiente de teste. Estes passos não foram executados pelo agente.

1. Abrir todas as páginas da tabela em **320, 375, 768, 1024 e 1440 px**. Conferir títulos, campos, fotos, nomes/e-mails longos, estados vazios e ausência de rolagem horizontal da página. Nas tabelas, conferir rolagem interna com mouse, toque e teclado.
2. Com proprietário e funcionário, abrir/fechar o menu móvel, percorrer Tab/Shift+Tab e Escape, conferir foco visível e “Pular para o conteúdo”. Conferir os itens de cada perfil, foto/nome abrindo Perfil, Sair, `/configuracoes` indo ao Perfil e retorno de Usuários ao Dashboard.
3. Abrir os modais de produto, movimento, plantio, colheita, encerramento, animal, alimentação, vacinação e histórico. Conferir título/labels, rolagem, botões, foco dentro do diálogo e retorno ao acionador. No plantio, o primeiro foco deve ser Lote e Escape deve fechar fora do salvamento.
4. Em ambiente de teste, salvar plantio com rede lenta e duplo clique: deve haver um POST; Cancelar, fechar e Escape devem ficar bloqueados durante o envio. Testar rede indisponível/resposta inválida e conferir recuperação. Simular horário próximo da meia-noite de São Paulo e conferir a data máxima.
5. Conferir mensagens de erro/alerta/sucesso, campos e botões desabilitados, unidade Dose e histórico de encerramento em tela pequena e com motivo longo. Verificar os SVGs e contraste; realizar conferência com leitor de tela quando disponível.

## Pendências de testes reais de negócio e segurança

- **Encerramento:** banco real, índice parcial/CHECKs/FKs/default de data, atomicidade e rollback, duas conexões concorrentes e ordem lote → plantio, repetição/conflito, liberação de área e preservação de colheitas/movimentos/responsável. Ver roteiro completo em `docs/encerramento-cultivo-validacao.md`.
- **Estoque e animais:** saldos/alertas na igualdade, números inteiros em Dose, mensagens para legado incompatível sem conversão/arredondamento, duplicidade concorrente, movimentação/vacinação/alimentação e cadastro concorrente com desativação de espécie. Ver `docs/etapa-2-validacao.md`.
- **Permissões:** proprietário/funcionário em sessões reais, acesso direto às páginas e APIs de Fazenda/Usuários, bloqueio sem sessão/usuário inativo/versão de sessão inválida, login e logout. Ocultar itens na sidebar não substitui esta validação.

Essas pendências permanecem explícitas; os testes simulados aprovados não as encerram.
