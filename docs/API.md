# API

NestJS REST, porta padrão 3001. Endpoint de health: GET /health.

Domínio de Gestão Agrícola: recursos /propriedades, /talhoes, /safras, /procedimentos, /insumos, /planejamentos, /execucoes e /compras-insumo, com métodos GET, POST, PATCH e DELETE conforme o recurso.
Formas exatas de request/response: Swagger UI em /docs (fonte da verdade, não duplicada aqui).

Rotas por recurso (GET sem id sempre lista; GET com id sempre existiu ou foi adicionado nesta rodada):

- **Propriedade**: GET /propriedades, GET /propriedades/:id, POST /propriedades, PATCH /propriedades/:id,
  DELETE /propriedades/:id.
- **Talhão**: GET /propriedades/:propriedadeId/talhoes (aninhado), GET /talhoes/:id,
  POST /propriedades/:propriedadeId/talhoes (aninhado), PATCH /talhoes/:id, DELETE /talhoes/:id.
- **Safra**: GET /safras, GET /safras/:id, POST /safras, PATCH /safras/:id, DELETE /safras/:id.
- **Procedimento**: GET /procedimentos, GET /procedimentos/:id, POST /procedimentos, PATCH /procedimentos/:id,
  DELETE /procedimentos/:id.
- **Insumo**: GET /insumos, GET /insumos/:id, POST /insumos, PATCH /insumos/:id (só preço), DELETE /insumos/:id.
- **Planejamento**: GET /planejamentos, GET /planejamentos/:id, POST /planejamentos, DELETE /planejamentos/:id
  (condicional — só se não houver Execução vinculada; ver abaixo). Sem PATCH.
- **Execução**: GET /execucoes, GET /execucoes/:id, POST /execucoes. Sem PATCH, sem DELETE — histórico
  financeiro imutável.
- **Compra de Insumo**: GET /compras-insumo, GET /compras-insumo/:id, POST /compras-insumo. Sem PATCH, sem
  DELETE — histórico financeiro imutável.

DELETE nas entidades de catálogo (Propriedade, Talhão, Safra, Procedimento, Insumo) sempre tenta excluir; se
existir Planejamento/Execução/CompraInsumo vinculado, a trava `ON DELETE RESTRICT` do banco rejeita e a API
traduz isso em 400 (em vez de vazar um 500 de FK), via `apps/api/src/common/excluir-com-restricao.ts`. Sem
vínculo, a exclusão responde 204. DELETE de Planejamento é diferente: não depende de FK do banco (a FK de
Execução para Planejamento é `SetNull`), é uma regra de negócio — rejeita com 400 se já existir Execução
vinculada ("Não é possível excluir um planejamento já executado"), senão 204. Todo DELETE é restrito à
organização do chamador (404 ao tentar excluir registro de outra organização) e não tem restrição de papel —
qualquer `ORG_ADMIN` ou `ORG_MEMBER` autenticado pode chamar, igual já valia para criar/editar.

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
