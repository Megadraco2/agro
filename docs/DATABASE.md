# Banco de dados

PostgreSQL 17 via compose.yaml; dados persistem no volume postgres_data.
Variáveis no .env da raiz: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB e POSTGRES_PORT (5432).
Os valores dos exemplos servem exclusivamente ao desenvolvimento e devem ser substituídos.

apps/api/.env contém DATABASE_URL, acessível apenas ao backend/CLI Prisma.
Mantenha usuário, senha, banco e porta coerentes com o Compose. Codifique caracteres especiais na URL.
Prisma 6.19 usa apps/api/prisma/schema.prisma, com os modelos do domínio de Gestão Agrícola e duas migrations:
20261014012732_add_gestao_agricola_dominio (modelos) e 20261014064841_add_organizacao_slug_seed_default (chave
única `slug` em Organizacao + semeadura da organização padrão como dado de infraestrutura).
O gerador prisma-client prepara o cliente a partir desses modelos; saída local ignorada em apps/api/src/generated/prisma.

A organização padrão (`slug = "default"`) é criada pela migration, nunca em request-time — `CurrentOrganizationService`
só lê (`findUnique` por slug) e falha alto se a linha não existir. Isso evita duas organizações nascerem de uma corrida
entre requisições concorrentes na primeira inicialização (ver docs/BACKLOG.md, item 1).

Comandos:

- pnpm db:validate
- pnpm db:generate
- pnpm --filter @agro/api db:migrate --name nome_da_mudanca (dev local, interativo — somente após aprovar modelos)
- pnpm --filter @agro/api db:migrate:deploy (aplica migrations existentes, não-interativo — usado em CI/produção)

Nenhuma consulta é executada pelo health. Um provider Prisma com ciclo de conexão será adicionado quando houver persistência real.
Não exponha porta do banco publicamente. Backups, recuperação, TLS e permissões de produção precisam ser definidos na implantação.

## Autenticação e multiempresa

A migration `20261014100000_add_autenticacao_multiempresa` adiciona 4 tabelas novas, de identidade e
acesso (não fazem parte do domínio de Gestão Agrícola — ver docs/DOMAIN.md):

- `AdminSistema` — operadores da plataforma, com `email` único e `senhaHash`.
- `SessaoAdminSistema` — sessões revogáveis de `AdminSistema` (`expiraEm`, `revogadaEm`), referenciada
  pelo cookie `agro_admin_session`.
- `Usuario` — membros de uma `Organizacao`, com `email` único (global, não só por organização),
  `senhaHash` e `papel` (`ORG_ADMIN` ou `ORG_MEMBER`).
- `SessaoUsuario` — sessões revogáveis de `Usuario`, referenciada pelo cookie `agro_session`.

Nenhuma delas é populada por migration — dados existentes de `Organizacao` permanecem sem
`Usuario` associado; cabe ao admin de sistema criar organizações (e seu primeiro `ORG_ADMIN`) pela
rota `POST /admin/organizacoes`, e ao `AdminBootstrapService` criar o primeiro `AdminSistema` no
boot (ver docs/AUTH.md).

A mesma migration adiciona a coluna `Organizacao.maxUsuarios` (inteiro, default `5`) — limite de
vagas de `Usuario` por organização, verificado em `POST /usuarios` antes de criar um novo membro.

A migration `20261014110000_add_token_hash_sessoes` adiciona `tokenHash` (texto, único, obrigatório)
a `SessaoAdminSistema` e `SessaoUsuario`: o SHA-256 do token aleatório que vai no cookie. O `id`
(cuid) continua sendo a chave primária interna, mas deixou de ser o valor do cookie. Sessões que já
existiam antes dela não têm token correspondente — a migration as preenche com um marcador
(`legado:<id>`) que nunca casa com o hash de nenhum cookie e as marca como revogadas, sem apagar
linhas.

A trava `ON DELETE RESTRICT` de `20261014090000_restrict_catalogo_para_transacional` (ver docs/BACKLOG.md,
item 6) era só teórica até aqui — não existia rota DELETE pra acioná-la, só testes diretos via Prisma
Client. Agora `DELETE /propriedades/:id`, `/talhoes/:id`, `/safras/:id`, `/procedimentos/:id` e
`/insumos/:id` exercitam a trava de verdade em produção: se a linha de catálogo ainda tem
Planejamento/Execução/CompraInsumo vinculado, o Postgres rejeita com `P2003` e a API traduz isso em 400
(`apps/api/src/common/excluir-com-restricao.ts`), em vez de deixar a FK falhar como 500.
