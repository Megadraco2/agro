# API

NestJS REST, porta padrão 3001. Único endpoint de aplicação: GET /health.

Resposta HTTP 200, JSON:

```json
{ "status": "ok" }
```

Cache-Control: no-store. Não consulta banco nem representa readiness das dependências.
Contrato Zod em @agro/contracts. O frontend valida status HTTP e payload e usa timeout de cinco segundos.
Sem prefixo /api nesta fundação.

Swagger UI: /docs. Documento OpenAPI: /docs-json. São rotas de documentação.
ValidationPipe global usa whitelist, forbidNonWhitelisted e transform; futuros DTOs devem declarar validações no backend.
A configuração de ambiente já é validada por Zod. Não existem inputs de negócio para validar.

Ambiente privado:

- PORT: inteiro de 1 a 65535, padrão 3001.
- CORS_ORIGIN: origem exata do frontend, sem barra final; obrigatória.
- DATABASE_URL: URL PostgreSQL obrigatória; não é devolvida em erros.
- NODE_ENV: development, test ou production.

CORS permite GET e a origem configurada. Expandir métodos somente com novos contratos.
