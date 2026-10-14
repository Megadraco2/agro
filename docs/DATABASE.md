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
