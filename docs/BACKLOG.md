# Backlog de robustez

Achados da revisão final de código do domínio de Gestão Agrícola (14/10/2026, branch `dev`), que não bloquearam
o merge mas foram deliberadamente adiados por serem decisões de arquitetura/escopo, não bugs de implementação.
Este documento é o registro vivo de "em que pé está cada um" — atualize o status conforme forem resolvidos.

## 1. Organização única sem trava de concorrência

**Status:** ✅ Resolvido (14/10/2026)

`CurrentOrganizationService.getId()` fazia find-or-create sem unique constraint nem lock — duas requisições
concorrentes na primeira inicialização podiam criar duas organizações, espalhando dados invisivelmente entre
elas. Corrigido: a organização padrão agora é semeada pela migration `20261014064841_add_organizacao_slug_seed_default`
(dado de infraestrutura, não de request-time) contra uma chave única `slug`; `getId()` virou só leitura e
falha alto (`InternalServerErrorException`) se a linha não existir. Zero janela de corrida possível — a
criação nunca mais acontece fora de uma migration. Ver docs/DATABASE.md e docs/AUTH.md.

## 2. Testes apagam o banco de desenvolvimento

**Status:** ✅ Resolvido (14/10/2026)

`pnpm test` rodava contra a mesma `DATABASE_URL` que `pnpm dev` usa localmente — e isso realmente mordeu
durante o trabalho no item 1 (um teste apagou a organização semeada do banco de dev por engano). Corrigido:
Jest agora carrega `apps/api/.env.test` (não `.env`) via `apps/api/test/jest.setup.ts`, apontando pra um
banco `agro_test` separado no mesmo Postgres local. Setup de uma vez por máquina documentado no README. Em CI
não precisa de nada — o workflow já sobe um Postgres de serviço isolado por execução, e dotenv nunca
sobrescreve env vars já setadas pelo processo (verificado simulando exatamente esse cenário: sem
`.env.test`, só env vars de shell, suíte completa passando).

## 3. Testes que o spec pedia e nunca foram escritos

**Status:** ✅ Resolvido (14/10/2026)

A spec original (docs/superpowers/specs/2026-10-13-gestao-agricola-dominio-design.md, seção "Testes") listava
três casos. Os três foram implementados:

- ✅ Mudar o preço de um Insumo não altera `custoEstimado`/`custoTotal`/snapshots já gravados — teste de
  regressão adicionado em `planejamentos.test.ts`, `execucoes.test.ts` e `compras-insumo.test.ts` (cria,
  muda o preço via PATCH, reconsulta, confirma que nada mudou).
- ✅ Cada contrato Zod (`@agro/contracts`) aceita payload válido e rejeita payload inválido/campo extra —
  25 testes novos em `packages/contracts/schemas.test.ts`, um bloco por recurso.
- ✅ Execução não pode referenciar Talhão de Propriedade de outra Organização — agora existe uma segunda
  organização de verdade (provisionada via `POST /admin/organizacoes`, o fluxo real de admin do sistema), e
  todo lookup por `id` nas 8 entidades do domínio agrícola (Propriedade, Talhão, Safra, Procedimento, Insumo,
  Planejamento, Execução, CompraInsumo) passou a filtrar por `organizacaoId` — inclusive as checagens de
  existência de FK dentro de `create()` em Planejamento/Execução/CompraInsumo, não só os `getOrThrow` simples.
  Caso especial: `Talhão` não tem coluna `organizacaoId` própria, então o filtro é via relação
  (`findFirst({ where: { id, propriedade: { organizacaoId } } })`). `apps/api/test/isolamento-organizacoes.test.ts`
  tem 10 testes cobrindo as 8 entidades, cada um criando dados numa organização e tentando
  ler/atualizar/referenciar/listar esses dados autenticado como outra:
  - Propriedade (GET por id → 404), Safra (PATCH por id → 404), Talhão (GET por id → 404, o caso especial
    via relação), Insumo (PATCH por id → 404, e o preço da Org A continua intacto);
  - Planejamento: criar referenciando Talhão/Procedimento/Insumo de outra organização → 404;
  - CompraInsumo: criar referenciando só a Safra de outra organização → 404;
  - Procedimento (sem rota por id): criar Planejamento referenciando só o Procedimento de outra organização
    → 404, e `GET /procedimentos` não lista os da outra organização;
  - Execução (sem rota por id — só `GET /execucoes` e `POST /execucoes`): criar referenciando só o
    Planejamento de outra organização → 404, e `GET /execucoes` filtrando pelos ids de Safra/Talhão da outra
    organização volta vazio.

  Além disso, `apps/api/test/sem-sessao.test.ts` confirma que as rotas de listagem e criação das 8 entidades
  (16 rotas) respondem 401 a uma requisição sem header `Cookie`.

## 4. Sem limite máximo em campos numéricos

**Status:** ✅ Resolvido (14/10/2026)

Nenhum DTO tinha `@Max` — só `@IsPositive()`. Corrigido em duas camadas, porque uma só não bastava: limites
por campo generosos (`@Max`) sozinhos não impedem o estouro do **resultado calculado**, já que campos
individualmente válidos se multiplicam (`dosePorHa × talhao.areaHa × insumo.precoUnitarioAtual`).

1. **`@Max` por campo** (sanidade básica, 400 imediato): área de Propriedade/Talhão até 1.000.000 ha, preço
   de Insumo até R$1.000.000/unidade, dose por ha até 10.000, quantidade (Execução/Compra) até 10.000.000,
   sacas colhidas até 10.000.000 — todos bem acima de qualquer cenário real.
2. **Checagem do resultado calculado** (`apps/api/src/common/limite-custo.ts`): antes de persistir
   `custoEstimado`/`custoTotal`, valida contra um teto de R$100 bilhões (bem abaixo da capacidade real da
   coluna `Decimal(14,2)`, ~R$1 trilhão) — se estourar, 400 explícito em vez de deixar o Postgres falhar
   sozinho. Usado por Planejamento, Execução e CompraInsumo, os três que calculam custo.

10 testes novos (6 de limite por campo + 4 de estouro do resultado calculado, combinando valores
individualmente válidos que juntos excedem o teto).

## 5. PATCH de Safra invalida retroativamente Planejamento/Execução

**Status:** ✅ Resolvido (14/10/2026)

`PATCH /safras/:id` permitia reescrever `dataInicio`/`dataFim` livremente, mas `Planejamento`/`Execução` só
validavam "data dentro do período da safra" na criação — estreitar a janela de uma safra existente deixava
registros já criados silenciosamente fora da regra, sem nenhuma revalidação. Corrigido em
`SafrasService.update()` (`apps/api/src/safras/safras.service.ts`): quando a nova janela é mais estreita que a
atual (início adiado e/ou fim antecipado), o service consulta `PlanejamentoItem`/`ExecucaoItem` vinculados a
essa safra e rejeita o PATCH com 400 se algum ficaria fora da nova janela. Alargar a janela nunca aciona a
checagem — nunca invalida nada, então não precisa da query. 3 testes novos em `apps/api/test/safras.test.ts`
(rejeita excluir um planejamento, rejeita excluir uma execução, aceita estreitar quando tudo continua dentro).

Escopo deliberadamente limitado a `PlanejamentoItem`/`ExecucaoItem`, como o achado original descrevia. Durante
a investigação, notei que `CompraInsumo` tem o mesmo campo `safraId`/`data` mas **nunca validou** "dentro do
período da safra", nem na criação — é uma lacuna preexistente e separada, não descoberta pela revisão final,
registrada aqui para decisão futura em vez de corrigida sem pedido.

## 6. Cascade de exclusão de catálogo até histórico financeiro

**Status:** ✅ Resolvido (14/10/2026)

Todo FK de entidade de catálogo (Insumo, Procedimento, Safra, Talhão) para entidade transacional
(PlanejamentoItem/PlanejamentoInsumo, ExecucaoItem/ExecucaoInsumo, CompraInsumo) era `ON DELETE CASCADE` —
escolha motivada pela conveniência de limpeza de teste, não por decisão de produto. Um `DELETE` de Insumo
apagaria as linhas de custo de execuções/planejamentos históricos, deixando o `custoTotal` do registro pai
(que não cascateia, é só um número já gravado) incoerente com seus componentes. Corrigido preventivamente,
fechando a armadilha antes que uma rota DELETE aparecesse por engano:

- Migration `20261014090000_restrict_catalogo_para_transacional` troca as 11 FKs catálogo→transacional de
  `CASCADE` para `RESTRICT`: `PlanejamentoItem→{Safra,Talhao,Procedimento}`, `PlanejamentoInsumo→Insumo`,
  `ExecucaoItem→{Safra,Talhao,Procedimento}`, `ExecucaoInsumo→Insumo`, `CompraInsumo→{Talhao,Safra,Insumo}`.
  Ficam `CASCADE` (fora de escopo, não são catálogo→transacional): toda FK de `Organizacao` (única cascata de
  produto real — organização removida leva tudo), `Propriedade→Talhao` (estrutural), e os pares pai-filho
  internos ao próprio registro transacional (`PlanejamentoItem→PlanejamentoInsumo`,
  `ExecucaoItem→ExecucaoInsumo`).
- A troca quebrou `limparBanco()` (usado em todo `beforeEach` de teste): `organizacao.deleteMany()` dependia
  de uma cascata concorrente entre múltiplos caminhos (`Organizacao→Insumo` direto e
  `Organizacao→PlanejamentoItem→PlanejamentoInsumo→Insumo`) cuja ordem de resolução o Postgres não garante —
  passou a tentar apagar o Insumo antes do PlanejamentoInsumo que ainda o referencia, e a suíte inteira
  falhou com `P2003`. Descoberto rodando a suíte, não por suposição. Corrigido tornando
  `apps/api/test/support/limpar-banco.ts` explícito: apaga filhos antes de pais em ordem de dependência, em
  vez de depender da cascata de Organizacao resolver isso por conta própria.
- 3 testes em `apps/api/test/integridade-referencial.test.ts` provam a trava direto via Prisma Client,
  sem depender de rota HTTP: rejeita apagar um Insumo referenciado por um PlanejamentoInsumo, rejeita apagar
  uma Safra referenciada por um PlanejamentoItem, e aceita apagar um registro de catálogo sem histórico
  vinculado.

**Atualização (14/10/2026) — a trava deixou de ser só teórica:** agora existe rota `DELETE` em Propriedade,
Talhão, Safra, Procedimento e Insumo (as 5 entidades de catálogo), implementada via o helper
`apps/api/src/common/excluir-com-restricao.ts`: o DELETE sempre tenta excluir, e se a trava `RESTRICT` do
Postgres rejeitar por existir histórico vinculado (`P2003`), o helper traduz isso em 400 em vez de deixar
vazar como 500; sem vínculo, responde 204. Todo DELETE é restrito à organização do chamador (404 pra
registro de outra organização) e sem distinção de papel (`ORG_ADMIN`/`ORG_MEMBER`), igual já valia pra
criar/editar. Planejamento ganhou um `DELETE` próprio, mas por regra de aplicação, não pela trava do banco
(a FK de Execução para Planejamento é `SetNull`, não `RESTRICT`): rejeita com 400
("Não é possível excluir um planejamento já executado") se já existir Execução vinculada, senão 204.
Execução e CompraInsumo continuam sem DELETE (e sem PATCH) — permanecem histórico financeiro imutável, de
propósito.

Cada uma das 6 entidades (as 5 de catálogo + Planejamento) tem teste de regressão próprio provando as duas
pontas do comportamento: cria vínculo de histórico → `DELETE` responde 400 e o registro continua listável;
sem vínculo → `DELETE` responde 204. Ver `apps/api/test/propriedades.test.ts`, `talhoes.test.ts`,
`safras.test.ts`, `procedimentos.test.ts`, `insumos.test.ts` e `planejamentos.test.ts`. O isolamento entre
organizações nas rotas DELETE novas também é coberto em `apps/api/test/isolamento-organizacoes.test.ts`
(excluir registro de outra organização → 404).

---

Itens menores (não listados individualmente aqui, ver o PR/revisão original para detalhes): Talhão sem
`organizacaoId` próprio (sem garantia a nível de banco de que um Talhão pertence à mesma organização que o
referencia), OpenAPI sem `@ApiProperty`/`@ApiResponse` nos DTOs, `computeStatus` compara por timestamp em vez
de dia civil, duplicar `insumoId` numa requisição gera 404 enganoso em vez de 400, faltam índices em algumas
FKs, sem paginação nos endpoints de listagem.
