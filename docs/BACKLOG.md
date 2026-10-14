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

**Status:** ⏳ Pendente

A spec original (docs/superpowers/specs/2026-10-13-gestao-agricola-dominio-design.md, seção "Testes") lista
três casos nunca implementados:

- Execução não pode referenciar Talhão de Propriedade de outra Organização.
- Mudar o preço de um Insumo não altera `custoEstimado`/snapshots já gravados.
- Cada contrato Zod (`@agro/contracts`) aceita payload válido e rejeita payload inválido/campo extra — hoje
  só o TypeScript garante que `toResponse()` bate com o tipo, não há teste de runtime rodando `.parse()`.

## 4. Sem limite máximo em campos numéricos

**Status:** ⏳ Pendente

Nenhum DTO tem `@Max` — só `@IsPositive()`. `custoEstimado` é o produto de três campos independentemente
validados (`dosePorHa × talhao.areaHa × insumo.precoUnitarioAtual`); uma combinação de valores
individualmente plausíveis pode estourar o `DECIMAL(14,2)` e virar um 500 não tratado (overflow do Postgres)
em vez de um 400 de validação. Precisa de limites por campo — depende de decisão de produto sobre valores
realistas (área máxima de propriedade, preço máximo de insumo etc.), não é só código.

## 5. PATCH de Safra invalida retroativamente Planejamento/Execução

**Status:** ⏳ Pendente

`PATCH /safras/:id` permite reescrever `dataInicio`/`dataFim` livremente. `Planejamento`/`Execução` só validam
"data dentro do período da safra" na criação — estreitar a janela de uma safra deixa registros já criados
silenciosamente fora da regra, sem nenhuma revalidação. Duas saídas possíveis: rejeitar um PATCH que excluiria
filhos existentes, ou restringir o PATCH de Safra a campos não-financeiros (mais alinhado com o que a spec já
diz sobre campos de custo serem imutáveis).

## 6. Cascade de exclusão de catálogo até histórico financeiro

**Status:** ⏳ Pendente

Todo FK de entidade de catálogo (Insumo, Procedimento, Safra, Talhão) para entidade transacional
(Planejamento/Execução/CompraInsumo) é `ON DELETE CASCADE` — escolha deliberada, mas motivada pela
conveniência de limpeza de teste (`organizacao.deleteMany()` cascateando tudo), não por uma decisão de
produto. Um `DELETE` de Insumo apagaria as linhas de custo de execuções/planejamentos históricos, deixando o
`custoTotal` do registro pai (que não cascateia, é só um número já gravado) incoerente com seus componentes.
Sem rota DELETE hoje, então não é explorável ainda — mas precisa virar uma decisão explícita (trocar
catálogo→transacional para `Restrict`) antes que qualquer rota DELETE seja adicionada.

---

Itens menores (não listados individualmente aqui, ver o PR/revisão original para detalhes): Talhão sem
`organizacaoId` próprio (sem garantia a nível de banco de que um Talhão pertence à mesma organização que o
referencia), OpenAPI sem `@ApiProperty`/`@ApiResponse` nos DTOs, `computeStatus` compara por timestamp em vez
de dia civil, duplicar `insumoId` numa requisição gera 404 enganoso em vez de 400, faltam índices em algumas
FKs, sem paginação nos endpoints de listagem.
