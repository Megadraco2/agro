# API

NestJS REST, porta padrão 3001. Endpoint de health: GET /health.

Domínio de Gestão Agrícola: recursos /propriedades, /talhoes, /safras, /procedimentos, /insumos, /planejamentos, /execucoes e /compras-insumo, com métodos GET, POST e PATCH conforme o recurso.
Formas exatas de request/response: Swagger UI em /docs (fonte da verdade, não duplicada aqui).

Resposta HTTP 200, JSON:

```json
{ "status": "ok" }
```

Cache-Control: no-store. Não consulta banco nem representa readiness das dependências.
Contrato Zod em @agro/contracts. O frontend valida status HTTP e payload e usa timeout de cinco segundos.
Sem prefixo /api nesta fundação.

Swagger UI: /docs. Documento OpenAPI: /docs-json. São rotas de documentação.
ValidationPipe global usa whitelist, forbidNonWhitelisted e transform; futuros DTOs devem declarar validações no backend.
A configuração de ambiente já é validada por Zod. Inputs de negócio são validados por DTOs class-validator em cada recurso do domínio.

Ambiente privado:

- PORT: inteiro de 1 a 65535, padrão 3001.
- CORS_ORIGIN: origem exata do frontend, sem barra final; obrigatória.
- DATABASE_URL: URL PostgreSQL obrigatória; não é devolvida em erros.
- NODE_ENV: development, test ou production.
- TRUST_PROXY_HOPS: inteiro >= 0, padrão 1; número de hops de proxy reverso confiáveis na frente da API (ver docs/AUTH.md).

CORS permite GET, POST e PATCH na origem configurada. Expandir métodos somente com novos contratos.
