# Estoque — primeira entrega de design e usabilidade

Esta entrega refina somente Estoque e seus dois modais, com ajustes necessários na sidebar. Os demais módulos aguardam avaliação do usuário; o relato dos seletores de Cultivo fica para a entrega desse módulo.

## Referências abertas e direção visual

Foram localizadas e abertas estas imagens da pasta `img figma`:

- `Estoque.png`: organização de título/ações, indicadores e listagem; identidade verde e superfícies claras.
- `Estoque-add.png` e `Estoque-add-1.png`: distinção Entrada/Saída e separação entre formulário e resumo.
- `Dashboard.png`: contexto da identidade visual, sem adotar indicadores financeiros ou módulos dessa imagem.

Não foi feita reprodução literal. Cards altos, sombras fortes, excesso de negrito, barra percentual e campos de origem/entidade fora do escopo não foram incorporados. Não havia capturas atuais separadas entre os arquivos de imagem encontrados; as referências acima são imagens do Figma fornecidas no projeto, não provas do estado anterior da aplicação.

## Problemas tratados e resultado

- Indicadores estavam altos, com número separado do texto por espaço excessivo. Agora são compactos, com borda discreta, sombra leve e explicação do que cada contagem representa. Os valores vêm das mesmas props/consultas existentes; não há crescimento, capacidade ou valor financeiro fictício.
- Busca dependia visualmente do placeholder; Filtros era somente um ícone. Agora há label visível, botão Filtros com SVG, contador de categoria/situação e descrição dos filtros aplicados mesmo quando recolhidos. Limpar filtros fica disponível para qualquer critério ativo, incluindo busca.
- A barra Nível repetia a situação e podia sugerir capacidade máxima. Foi removida da tabela e dos cards. A listagem mostra saldo/unidade, mínimo/unidade e situação escrita em badge discreto; alerta continua sendo **quantidade <= estoque mínimo**, incluindo igualdade e zero com mínimo zero.
- Cabeçalho da tabela agora é neutro, com números alinhados à direita e tabulares. Nomes/categorias/culturas longos quebram no contêiner. No celular a lista usa cards; a tabela a partir de 1024 px tem rolagem interna identificada e focável.
- A ação Movimentar por produto reutiliza o modal e as props específicas que já existiam. O botão inclui SVG/texto e nome acessível com o produto. O cabeçalho mantém Registrar movimentação geral e destaca Novo produto.
- Estoque vazio e busca sem resultados têm mensagens distintas. Quantidade de resultados é anunciada sem depender de cor. Histórico recente mantém dados, responsável, observação e horário de Brasília.
- Modais seguem cabeçalho/rodapé compactos, campos identificados, obrigatoriedade e instruções curtas. Movimentação coloca formulário e resumo lado a lado no desktop e em coluna nas telas menores. Preserva centésimos, prévia de saldo, limite/insuficiência, cultura e Dose inteira.
- Foco inicial explícito: Nome no cadastro, Produto na movimentação geral e Quantidade na ação por produto. Diálogo nativo mantém o conteúdo externo inerte; Escape e fechamento são bloqueados durante envio. O botão de origem recebe foco ao fechar. Erros preservam os valores preenchidos.
- Sidebar ficou mais compacta; somente a navegação rola, mantendo Perfil e Sair no rodapé. Ordem dos links, proteção de proprietário, logout e redirecionamento legado não mudaram.

## Preservação e arquivos alterados

O git status foi conferido antes de editar. Comparação dos hashes do estado inicial com o final confirmou que apenas estes cinco arquivos existentes da aplicação foram alterados nesta entrega:

1. `app/components/estoque-painel.tsx`
2. `app/components/produtomodal.tsx`
3. `app/components/movimentacaomodal.tsx`
4. `app/components/sidebar.tsx`
5. `app/globals.css` — somente refinamentos sob `.estoque-ui`; os estilos novos não redesenham os demais módulos.

Novos arquivos: `tests/estoque-design.test.mjs` e este relatório. Capturas/resultados do navegador, quando disponíveis, são identificados na seção de conferência visual.

APIs, payloads, consultas da página, sessão, permissões, Prisma, helpers de negócio e testes anteriores ficaram intactos. Nenhum banco/dado/schema foi modificado; não houve SQL, reset, db push, leitura de segredos do `.env`, instalação de biblioteca de interface, publicação ou push. Não foi utilizado zoom/scale/overflow escondido como correção de layout.

## Verificações de código e testes isolados

- TypeScript: `node_modules/.bin/tsc.cmd --noEmit --incremental false` — passou.
- Lint: `npm.cmd run lint` — passou.
- `git diff --check` — passou.
- `node --test tests/etapa2.test.mjs tests/encerramento-cultivo.test.mjs tests/etapa3.test.mjs tests/estoque-design.test.mjs` — **83/83 passaram**, dos quais 16 são novos nesta entrega.

Os testes novos usam React/JSX/DOM/rede simulados: busca por nome/cultura/código sem acento, combinação/contador/limpeza de filtros, alerta no limite, categoria de colheita legado, vazio vs sem resultados, ausência da barra percentual, labels, histórico, foco inicial/retorno, envio duplicado, Escape durante envio, manutenção de campos após erro e prévia em Dose. Não são testes visuais nem gravações em banco. Os 67 testes anteriores de negócio/navegação/encerramento também passaram.

## Conferência no navegador

A conferência foi preparada em um harness isolado sob `.next/estoque-design`, usando os componentes React e CSS do projeto com dados de exemplo explícitos. `next/link`, navegação e fetch foram substituídos apenas nesse harness; nenhuma requisição foi enviada ao servidor da aplicação ou ao banco atual. O harness não é uma rota publicada nem altera autenticação.

**Resultado: nenhuma validação visual ou captura foi concluída.** O Edge no sandbox iniciou CDP, mas encerrou com `FATAL: GPU process isn't usable`, após falhas dos processos GPU com acesso negado. A tentativa de execução fora do sandbox ficou sem conclusão e foi interrompida; não houve confirmação de aprovação ou rejeição automática com motivo. As portas 4178/9226 estão fechadas e nenhum processo criado para esse harness permaneceu identificado. O servidor Next existente foi preservado; ficaram apenas arquivos temporários ignorados na pasta acima.

As larguras **320, 375, 768, 1024 e 1440 px**, janela baixa, zoom real de 200%, contenção real de foco, teclado, modais, filtros e fotos/nomes longos permanecem pendentes de conferência no navegador. Os testes de foco com DOM simulado não substituem esses testes. Não há resultado visual produzido por navegador disponível nesta entrega.

## Roteiro manual na aplicação autenticada

1. Conferir Estoque em **320, 375, 768, 1024 e 1440 px**, janela baixa e zoom real de 200%. Usar nomes longos; conferir cards/tabela, ações, filtros, saldo/mínimo e rolagem somente interna quando necessária.
2. Buscar por nome, código e cultura; combinar categoria/situação; recolher filtros; conferir contador, resultados, Limpar filtros e diferença entre estoque vazio e busca sem resultado.
3. Abrir os dois modais e Movimentar por produto; usar Tab/Shift+Tab/Escape; conferir foco inicial, contenção e retorno. Conferir labels, culturas, Dose inteira, prévia Entrada/Saída, saldo insuficiente, carregamento e recuperação de erro sem perder campos. Gravações somente em ambiente de teste identificado.
4. Com proprietário/funcionário, conferir menu móvel, rodapé, Perfil/Sair e links de administração. Conferir acesso direto às páginas/APIs com sessões reais; a apresentação da sidebar não prova a autorização.

## Pendências preservadas

- Testes reais com banco de encerramento: índice parcial, restrições/defaults, bloqueios/conexões concorrentes, atomicidade/rollback, repetição/conflito e preservação de histórico/área/saldos. Ver `docs/encerramento-cultivo-validacao.md`.
- Testes reais de estoque/animais: doses/legado, saldos, duplicidade concorrente, movimentação/vacinação/alimentação e coordenação com desativação de espécie. Ver `docs/etapa-2-validacao.md`.
- Permissões/login/logout em sessões reais e conferência com leitor de tela. Build de produção não executado nesta entrega.
- Após a avaliação desta entrega, aplicar o padrão aprovado aos demais módulos e reproduzir/corrigir os seletores de Cultivo.
