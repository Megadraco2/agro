# CRUD Completo do Domínio Agrícola — Design

## Contexto

O backend do domínio de Gestão Agrícola (8 entidades: Propriedade, Talhão, Safra, Procedimento, Insumo,
Planejamento, Execução, Compra de Insumo) e a autenticação/multiempresa estão completos e testados. Ao
desenhar as telas de domínio no frontend (sub-projeto 1, pausado — ver
`docs/superpowers/specs/` da autenticação para o histórico), ficou claro que a superfície REST não é uniforme
entre entidades: faltam rotas em alguns casos (sem motivo de design, só porque nunca foram pedidas) e em
outros a ausência é deliberada (histórico financeiro imutável). Este documento fecha essa superfície de uma
vez, com cada decisão justificada, antes de voltar ao frontend — assim as telas são construídas sobre uma API
já estável, sem retrabalho.

## Estado atual (auditado em 14/10/2026)

| Entidade         | GET lista                    | GET por id | POST          | PATCH                                                                                                      | DELETE |
| ---------------- | ---------------------------- | ---------- | ------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| Propriedade      | ✅                           | ✅         | ✅            | ✅ (nome+areaHa)                                                                                           | ❌     |
| Talhão           | ✅ (aninhado em Propriedade) | ✅         | ✅ (aninhado) | ✅ (nome+areaHa)                                                                                           | ❌     |
| Safra            | ✅                           | ✅         | ✅            | ✅ (todos os campos, com guarda contra estreitar a janela sobre registros existentes — docs/BACKLOG.md #5) | ❌     |
| Procedimento     | ✅                           | ❌         | ✅            | ❌                                                                                                         | ❌     |
| Insumo           | ✅                           | ❌         | ✅            | ✅ (só precoUnitarioAtual)                                                                                 | ❌     |
| Planejamento     | ✅                           | ✅         | ✅            | ❌                                                                                                         | ❌     |
| Execução         | ✅                           | ❌         | ✅            | ❌                                                                                                         | ❌     |
| Compra de Insumo | ✅                           | ❌         | ✅            | ❌                                                                                                         | ❌     |

## Decisões

### 1. Semântica de DELETE para entidades de catálogo

**Decisão:** hard delete real, sem campo `ativo`/soft delete. Funciona só quando o registro não tem nenhum
vínculo com histórico — a trava `ON DELETE RESTRICT` já existente nas FKs catálogo→transacional (
`docs/BACKLOG.md` #6, migration `20261014090000_restrict_catalogo_para_transacional`) garante isso no banco:
uma tentativa de apagar um registro referenciado lança `PrismaClientKnownRequestError` código `P2003`, que o
service traduz para `BadRequestException` (400) com mensagem clara — mesmo padrão já usado pra `P2002`
(email duplicado) em várias services. Não precisa de migration nova nem campo novo no schema; reaproveita o
que já existe.

Aplica-se a: Propriedade, Talhão, Safra, Procedimento, Insumo.

### 2. Registros transacionais continuam imutáveis (sem PATCH/DELETE), com uma exceção

**Decisão:** Execução e Compra de Insumo nunca ganham PATCH nem DELETE — é a mesma filosofia que já rege o
`precoUnitarioSnapshot` (preço congelado no momento do lançamento): uma vez que um registro representa
histórico financeiro real, ele não é editado nem apagado; uma correção é um novo lançamento. Alinhado com
prática contábil padrão.

**Exceção: Planejamento sem Execução vinculada.** Um Planejamento sem nenhuma Execução ligada a ele (status
computado `PLANEJADO` ou `ATRASADO`) é uma intenção futura, não histórico financeiro ainda — ganha DELETE,
mas o service verifica a existência de Execuções vinculadas antes de apagar e responde 400
("Não é possível excluir um planejamento já executado") se houver alguma. Um Planejamento cujo status já é
`EXECUTADO` (tem Execução vinculada) permanece tão imutável quanto a própria Execução.

### 3. GET por id em toda entidade, por consistência

**Decisão:** Procedimento, Insumo, Execução e Compra de Insumo ganham `GET /:id` (as outras 4 já têm). Custo
baixo, sem ambiguidade — é a peça de REST que falta pra toda entidade seguir o mesmo formato.

### 4. Procedimento ganha PATCH completo

**Decisão:** `nome` e `tipo`, mesmo formato de `CreateProcedimentoDto`. Confirmado que isso não introduz
nenhuma inconsistência nova: `PlanejamentoResponse`/`ExecucaoResponse` já armazenam só `procedimentoId` (não
um snapshot do nome/tipo do Procedimento), exatamente como já acontece hoje com Propriedade/Safra/Talhão —
editar o nome de um Procedimento depois de criado já teria o mesmo efeito retroativo de exibição que editar
uma Propriedade já tem hoje. Não é um precedente novo.

### 5. Quem pode apagar

**Decisão:** qualquer usuário autenticado da organização (`ORG_ADMIN` ou `ORG_MEMBER`) — mesma regra que já
vale hoje para criar/editar qualquer entidade de domínio (nenhuma rota de domínio distingue papel ainda).
DELETE segue o padrão existente em vez de introduzir uma exceção.

## Rotas novas, por arquivo

- `apps/api/src/propriedades/propriedades.controller.ts` — `DELETE /propriedades/:id`
- `apps/api/src/talhoes/talhoes.controller.ts` — `DELETE talhoes/:id`
- `apps/api/src/safras/safras.controller.ts` — `DELETE /safras/:id`
- `apps/api/src/procedimentos/procedimentos.controller.ts` — `GET /procedimentos/:id`, `PATCH /procedimentos/:id`, `DELETE /procedimentos/:id`
- `apps/api/src/insumos/insumos.controller.ts` — `GET /insumos/:id`, `DELETE /insumos/:id`
- `apps/api/src/planejamentos/planejamentos.controller.ts` — `DELETE /planejamentos/:id`
- `apps/api/src/execucoes/execucoes.controller.ts` — `GET /execucoes/:id`
- `apps/api/src/compras-insumo/compras-insumo.controller.ts` — `GET /compras-insumo/:id`

Toda rota nova (GET por id, PATCH, DELETE) segue o padrão já estabelecido: busca escopada pela organização do
chamador (`CurrentOrganizationService.getId()`), 404 se não encontrado (incluindo o caso de pertencer a outra
organização — não revela a existência do registro), `findFirst`/relação com `organizacaoId` em vez de
`findUnique({ where: { id } })` isolado. Para Talhão, isso significa a mesma forma especial já usada em todo
o resto do código: `propriedade: { organizacaoId }`, já que Talhão não tem `organizacaoId` próprio.

DELETE sempre responde `204` sem corpo (mesmo padrão de `POST /auth/logout`).

## Contratos (`packages/contracts`)

- Nenhum schema de resposta novo: `GET /:id` reaproveita o `XResponse` já exportado de cada entidade; `DELETE`
  não tem corpo.
- `apps/api/src/procedimentos/procedimentos.dto.ts` ganha `UpdateProcedimentoDto` (mesmos campos de
  `CreateProcedimentoDto`).

## Testes

Por rota nova, seguindo os padrões já estabelecidos no projeto:

- **DELETE com vínculo** → 400 (criar o registro, criar algo que o referencia, tentar apagar, confirmar que
  continua existindo).
- **DELETE sem vínculo** → 204, e uma busca seguinte confirma que sumiu.
- **DELETE de registro de outra organização** → 404 (reaproveita o padrão de
  `apps/api/test/isolamento-organizacoes.test.ts`, que já cria uma segunda organização autenticada).
- **DELETE de Planejamento já executado** → 400; **DELETE de Planejamento não executado** → 204.
- **GET por id de outra organização** → 404 (mesmo padrão de isolamento).
- **PATCH de Procedimento** → 200 com os campos atualizados; de outra organização → 404.

## Fora de escopo

- Soft delete / campo `ativo` — decisão explícita pela opção mais simples (seção 1).
- PATCH/DELETE em Execução ou Compra de Insumo — permanecem imutáveis (seção 2).
- Papel diferenciado (`ORG_ADMIN` vs `ORG_MEMBER`) para DELETE — mantém a regra já existente de criar/editar
  (seção 5); pode ser revisitado no futuro se o produto precisar.
- Telas de frontend para as novas capacidades (DELETE, edição de Procedimento) — este documento é só a API;
  o design de frontend (sub-projeto 1, já aprovado) é atualizado separadamente para incluir essas ações
  quando a implementação deste CRUD completar.
