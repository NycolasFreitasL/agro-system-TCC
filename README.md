# AgroSystem

Sistema de gestão rural do TCC, com Dashboard, Estoque, Cultivo, Animais,
Fazenda, Perfil e administração de Usuários. Usa Next.js, Prisma e PostgreSQL.

## Preparação local

Use Node.js compatível com Next e Prisma: 20.19+, 22.12+ ou 24+ nas faixas
declaradas em `package.json`. A verificação atual usou Node 24.18.0.

```sh
npm ci --include=dev
npm run prisma:validate
npm run lint
npm run typecheck
npm test
npm run build
```

No Windows PowerShell, use `npm.cmd` se a política de execução impedir
`npm.ps1`. O `postinstall` e o `prebuild` geram o Prisma Client usando
`prisma/generate.config.ts`, sem carregar `.env` nem acessar o banco.
Se a instalação bloquear scripts, execute `npm run prisma:generate`
explicitamente antes da verificação de tipos. A geração não cria tabelas.

Para executar a aplicação, forneça as variáveis de servidor descritas no
[roteiro de publicação](docs/preparacao-publicacao.md), com o banco já
preparado. Não versionar segredos nem usar prefixo `NEXT_PUBLIC_` para eles.

```sh
npm run dev
```

Após um build, `npm start` executa o servidor de produção. Esse comando
não publica o projeto. Produção requer HTTPS e as proteções da hospedagem.

## Publicação e banco

Consulte [preparação e verificação de publicação](docs/preparacao-publicacao.md)
para banco existente/novo, configuração inicial, bloqueadores e testes reais.
O repositório não contém migrations completas para criar um banco vazio;
não usar `db push`, reset ou reaplicar o SQL já executado como atalho.

Os testes existentes usam dependências simuladas. Aprovação desses testes
não comprova transações no PostgreSQL real nem funcionamento no navegador.
