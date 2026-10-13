# Banco de dados

PostgreSQL 17 via compose.yaml; dados persistem no volume postgres_data.
Variáveis no .env da raiz: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB e POSTGRES_PORT (5432).
Os valores dos exemplos servem exclusivamente ao desenvolvimento e devem ser substituídos.

apps/api/.env contém DATABASE_URL, acessível apenas ao backend/CLI Prisma.
Mantenha usuário, senha, banco e porta coerentes com o Compose. Codifique caracteres especiais na URL.
Prisma 6.19 usa apps/api/prisma/schema.prisma, atualmente sem modelos ou migrations.
O gerador prisma-client permite preparar o cliente sem inventar tabelas; saída local ignorada em apps/api/generated/prisma.

Comandos:

- pnpm db:validate
- pnpm db:generate
- pnpm --filter @agro/api db:migrate --name nome_da_mudanca (somente após aprovar modelos)

Nenhuma consulta é executada pelo health. Um provider Prisma com ciclo de conexão será adicionado quando houver persistência real.
Não exponha porta do banco publicamente. Backups, recuperação, TLS e permissões de produção precisam ser definidos na implantação.
