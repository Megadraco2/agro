# Agro

SaaS agrícola: Next.js/PWA e NestJS REST em monorepo pnpm/Turborepo.
Domínio de Gestão Agrícola implementado: Propriedade, Talhão, Safra, Procedimento, Insumo, Planejamento, Execução e Compra de Insumo — ver [domínio](docs/DOMAIN.md) e [API](docs/API.md).
Autenticação e multiempresa implementadas: admin de sistema cria organizações, cada organização isola seus próprios usuários e dados — ver [autenticação](docs/AUTH.md).

## Requisitos e início

Node.js 22.16+ na linha 22, pnpm 10.34.5 e Docker Desktop iniciado.
Se pnpm não estiver disponível, use `npx --yes pnpm@10.34.5` no lugar de `pnpm`.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
docker compose up -d postgres
pnpm db:validate
pnpm db:generate
pnpm --filter @agro/api db:migrate
pnpm dev
```

No primeiro boot, defina `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD` em `apps/api/.env` —
a API cria o primeiro `AdminSistema` (operador da plataforma, para logar em `/admin/login` e criar
organizações) com essas credenciais se a tabela estiver vazia, e falha ao subir se ambas as
condições (tabela vazia e variáveis ausentes) ocorrerem juntas. Depois que o primeiro admin existe,
essas variáveis são ignoradas em boots seguintes.

Web: http://localhost:3000. API: http://localhost:3001/health.
Swagger: http://localhost:3001/docs. OpenAPI: /docs-json.
A API inicia sem conexão com o banco; health verifica somente o processo HTTP.
Use o botão “Verificar API” na página inicial.

## Validações

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm format` aplica Prettier. Hooks Husky executam lint-staged e commitlint.
Após criar/clonar o repositório Git, execute `pnpm prepare` para ativar os hooks.
Não é necessário Git para compilar ou testar.

### Banco de teste (uma vez por máquina)

`pnpm test` usa um banco separado do `pnpm dev`, pra nunca apagar dado de desenvolvimento em andamento.
Configure uma vez:

```powershell
Copy-Item apps/api/.env.test.example apps/api/.env.test
# edite apps/api/.env.test trocando o nome do banco na DATABASE_URL para agro_test
```

```sh
DATABASE_URL="postgresql://agro:change-me-local-only@localhost:5432/agro_test?schema=public" pnpm --filter @agro/api exec prisma migrate dev --name init
```

Cria o banco `agro_test` (se ainda não existir) e aplica as migrations nele. Depois disso, `pnpm test` sempre
usa esse banco sozinho — não precisa repetir o passo. Em CI, isso não é necessário: o workflow já sobe um
Postgres de serviço isolado por execução (ver `.github/workflows/ci.yml`).

## CI

GitHub Actions (`.github/workflows/ci.yml`) roda lint, typecheck, test e build em todo push e Pull Request contra `dev` e `main`.
Os testes da API usam um Postgres de serviço do próprio runner; as migrations são aplicadas com `prisma migrate deploy` (variante não interativa de CI, sem shadow database) antes da suíte rodar.
Um segundo job builda a imagem Docker da API (`apps/api/Dockerfile`) apenas se a validação anterior passar.

## Produção e PWA local

```sh
pnpm build
pnpm --filter @agro/api start
pnpm --filter @agro/web start
```

Execute os dois comandos start em terminais separados. Copie os ambientes antes do build.
NEXT_PUBLIC_API_URL é público e incorporado ao bundle durante o build.
O service worker é registrado somente em produção. Consulte docs/PWA.md para instalação e teste offline.

## Docker

Compose mantém somente PostgreSQL local, com volume persistente e porta restrita ao loopback.
`docker compose down` preserva dados; não use `down -v` sem intenção explícita de apagá-los.

Dockerfiles independentes, executados a partir da raiz:

```sh
docker build -f apps/api/Dockerfile -t agro-api .
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t agro-web .
docker run --rm -p 3001:3001 --env-file apps/api/.env agro-api
docker run --rm -p 3000:3000 agro-web
```

Em containers, localhost não aponta ao PostgreSQL do host. Ajuste DATABASE_URL para a rede de implantação.
As imagens usam usuário sem privilégios; otimização de tamanho e pipeline de publicação ficam para a implantação real.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Produto](docs/PRODUCT.md) e [domínio](docs/DOMAIN.md)
- [Banco](docs/DATABASE.md), [API](docs/API.md) e [autenticação](docs/AUTH.md)
- [PWA](docs/PWA.md) e [interface](docs/UI-UX.md)
- [Backlog de robustez](docs/BACKLOG.md) — achados adiados da última revisão, com status
- [Regras para agentes](AGENTS.md)
