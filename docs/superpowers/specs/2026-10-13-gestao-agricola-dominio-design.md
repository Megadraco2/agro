# Domínio de Gestão Agrícola — Design

Data: 2026-10-13
Status: aguardando revisão do usuário

## Contexto

O AGRO é hoje só uma fundação técnica (Next.js + NestJS + Prisma, único recurso: `GET /health`), conforme `docs/DOMAIN.md` e `docs/PRODUCT.md` descrevem — nenhuma entidade de negócio foi aprovada ainda. Esta spec é a primeira descoberta de domínio exigida por esses documentos antes de qualquer migration.

A referência de produto é o **Agrare Gestor Rural**, um SaaS real de gestão de fazenda (material de estudo em `~/projeto_agro/ideia/`: vídeo de uso do app + 2 links do YouTube). O Agrare tem vários módulos (Painel, Gestão Agrícola, Estoque, Financeiro, Patrimonial, NF-e, NDVI, Caderno de Campo); o usuário escolheu **Gestão Agrícola** como primeiro recorte — especificamente o fluxo Safra × Talhão com as abas Planejamento, Execução e Colheita.

## Decisões de escopo (confirmadas com o usuário)

1. **Sem autenticação real ainda.** O modelo já carrega `organizationId` em tudo (pra não exigir migration quando auth chegar), mas por enquanto a organização é única e implícita — resolvida no backend a partir de um registro semeado (seed), não enviada pelo cliente. Login/multiempresa fica para uma spec própria, alinhado com `docs/AUTH.md`.
2. **Propriedade contém Talhões.** Duas entidades (não uma só), mesmo que os dados de demonstração do vídeo mostrem talhões do tamanho de fazendas inteiras.
3. **Catálogo de Procedimentos gerenciado pelo usuário**, crescendo com o uso — sem lista gigante pré-populada como a do Agrare completo.
4. **Catálogo leve de Insumo** (nome + unidade + preço unitário atual), sem controle de estoque/quantidade disponível — isso é module `Estoque`, fora deste escopo.
5. **Execução referencia Planejamento de forma opcional** (abordagem C, ver "Fluxos" abaixo) — não força todo gasto real a vir de um plano prévio.
6. **Escopo desta spec: schema Prisma + API REST (NestJS) + contratos Zod compartilhados.** Telas web (Next.js) ficam para um plano de implementação seguinte, reaproveitando esses contratos.

## Fora de escopo (explícito)

- Módulos Estoque (controle de quantidade/local), Financeiro, Patrimonial, NF-e, NDVI, Caderno de Campo offline — ver `docs/PRODUCT.md`.
- Autenticação, sessão, multiempresa real.
- Telas web (Next.js) — próximo plano.
- Migration real no banco (`pnpm --filter @agro/api db:migrate`) — só roda após o usuário aprovar os modelos, conforme `docs/DATABASE.md`.

## Glossário

| Termo                               | Significado                                                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Organização**                     | Dono dos dados (produtor/empresa rural). Único registro por enquanto.                                                                                                 |
| **Propriedade**                     | Uma fazenda/imóvel rural, com área total.                                                                                                                             |
| **Talhão**                          | Subdivisão de uma Propriedade onde se planta/cultiva, com área própria.                                                                                               |
| **Safra**                           | Um ciclo de cultivo (ex. "Colheitas 25/26 Soja"), com cultura e período. Dimensão independente do Talhão — um mesmo Talhão passa por várias Safras ao longo do tempo. |
| **Procedimento**                    | Um tipo de operação de campo cadastrável (ex. "1ª Aplicação de Fungicida", "Colheita", "Irrigação").                                                                  |
| **Insumo**                          | Um produto/material consumível (fungicida, diesel, semente) com preço unitário atual.                                                                                 |
| **Planejamento (PlanejamentoItem)** | Um Procedimento previsto para uma Safra × Talhão, com data prevista e custo estimado.                                                                                 |
| **Execução (ExecucaoItem)**         | Um Procedimento de fato realizado (data real, custo real, insumos usados, operador, máquina), opcionalmente cumprindo um Planejamento.                                |
| **Compra de Insumo (CompraInsumo)** | Um evento de aquisição de Insumo para uma Safra × Talhão, independente de execução de procedimento.                                                                   |

## Arquitetura — entidades e relacionamentos

```
Organizacao (1) ──┬── Propriedade (N) ── Talhao (N)
                   ├── Safra (N)
                   ├── Procedimento (N)
                   └── Insumo (N)

PlanejamentoItem ── Safra, Talhao, Procedimento
  └─ PlanejamentoInsumo (N) ── Insumo

ExecucaoItem ── Safra, Talhao, Procedimento
  ├─ planejamentoItemId? (opcional)
  └─ ExecucaoInsumo (N) ── Insumo

CompraInsumo ── Talhao, Safra, Insumo
```

### Por que esta separação

- **Safra e Talhão são dimensões independentes**, não hierárquicas — no vídeo, os filtros do app são dois seletores separados (Safra, Talhão), não um dentro do outro.
- **Colheita não é uma entidade própria.** No vídeo, um registro de colheita aparece no mesmo feed de Execução que uma aplicação (mesma estrutura: insumo/máquina/operador). Por isso, `ExecucaoItem` tem um campo opcional `quantidadeColhidaSacas`, preenchido só quando `Procedimento.tipo = COLHEITA`. Isso evita duplicar os relacionamentos com Safra/Talhão numa entidade `Colheita` separada.
- **CompraInsumo é separada de ExecucaoItem** porque não executa um procedimento — é um evento de aquisição, mais perto de "financeiro/estoque" do que de "operação de campo".
- **Preço "congelado" (snapshot).** Quando um plano ou execução usa um Insumo, o preço unitário daquele momento é copiado para a linha (`precoUnitarioSnapshot`), não referenciado ao vivo do catálogo. Mudanças de preço no catálogo não alteram custos já lançados.

## Modelos de dados (detalhado)

```
Organizacao
  id            String  @id @default(cuid())
  nome          String
  createdAt     DateTime @default(now())

Propriedade
  id              String  @id @default(cuid())
  organizacaoId   String
  nome            String
  areaHa          Decimal
  createdAt       DateTime @default(now())

Talhao
  id              String  @id @default(cuid())
  propriedadeId   String
  nome            String
  areaHa          Decimal
  createdAt       DateTime @default(now())

Safra
  id              String  @id @default(cuid())
  organizacaoId   String
  nome            String    // ex: "Colheitas 25/26 Soja"
  cultura         String    // ex: "Soja"
  dataInicio      DateTime
  dataFim         DateTime
  createdAt       DateTime @default(now())

Procedimento
  id              String  @id @default(cuid())
  organizacaoId   String
  nome            String
  tipo            TipoProcedimento  // APLICACAO | PLANTIO | COLHEITA | IRRIGACAO | OUTRO
  createdAt       DateTime @default(now())

Insumo
  id                String  @id @default(cuid())
  organizacaoId     String
  nome              String
  unidade           String    // ex: "litro", "kg", "unidade"
  precoUnitarioAtual Decimal
  createdAt         DateTime @default(now())

PlanejamentoItem
  id              String  @id @default(cuid())
  organizacaoId   String
  safraId         String
  talhaoId        String
  procedimentoId  String
  dataPrevista    DateTime
  custoEstimado   Decimal   // snapshot calculado na criação
  observacao      String?
  createdAt       DateTime @default(now())

PlanejamentoInsumo
  id                      String  @id @default(cuid())
  planejamentoItemId      String
  insumoId                String
  dosePorHa               Decimal
  precoUnitarioSnapshot   Decimal

ExecucaoItem
  id                      String  @id @default(cuid())
  organizacaoId           String
  safraId                 String
  talhaoId                String
  procedimentoId          String
  planejamentoItemId      String?   // vínculo opcional
  data                    DateTime
  custoTotal              Decimal   // snapshot calculado na criação
  operador                String?   // texto livre, sem entidade Usuário ainda
  maquina                 String?   // texto livre
  quantidadeColhidaSacas  Decimal?  // só quando procedimento.tipo = COLHEITA
  observacao              String?
  createdAt               DateTime @default(now())

ExecucaoInsumo
  id                      String  @id @default(cuid())
  execucaoItemId          String
  insumoId                String
  quantidade              Decimal
  precoUnitarioSnapshot   Decimal

CompraInsumo
  id                      String  @id @default(cuid())
  organizacaoId           String
  talhaoId                String
  safraId                 String
  insumoId                String
  data                    DateTime
  quantidade               Decimal
  precoUnitarioSnapshot   Decimal
  custoTotal              Decimal
  createdAt               DateTime @default(now())
```

Todas as entidades com `organizacaoId` apontam para a mesma organização semeada; o backend resolve esse valor internamente (não vem do cliente). Quando a autenticação for desenhada, essa resolução passa a vir da sessão — sem mudança de schema.

## Fluxos principais

### Planejar um procedimento

1. Usuário escolhe Safra, Talhão, Procedimento, data prevista e os Insumos com dose/ha.
2. Backend calcula `custoEstimado = Σ(dosePorHa × talhao.areaHa × insumo.precoUnitarioAtual)` e grava o snapshot em `PlanejamentoInsumo.precoUnitarioSnapshot`.

### Registrar a execução de um plano

1. Usuário parte de um `PlanejamentoItem` (ou cria uma execução avulsa, sem plano).
2. Informa data real, insumos de fato usados (quantidade), operador, máquina.
3. Backend calcula `custoTotal` da mesma forma, grava snapshots, e associa `planejamentoItemId` se aplicável.
4. Se `Procedimento.tipo = COLHEITA`, o formulário aceita `quantidadeColhidaSacas`.

### Status do Planejamento (calculado, não gravado em coluna)

- **Planejado** — nenhuma `ExecucaoItem` vinculada, `dataPrevista >= hoje`.
- **Atrasado** — nenhuma `ExecucaoItem` vinculada, `dataPrevista < hoje`.
- **Executado** — existe ao menos uma `ExecucaoItem` vinculada.

Simplificação deliberada: o Agrare completo distingue "Realizado Parcial" de "Realizado Total", mas a regra exata não é verificável a partir de 63s de vídeo. Three-state é suficiente para o MVP e evolui sem quebrar schema (ex. comparando área coberta pelas execuções vs área do talhão, no futuro).

### Comprar insumo

Evento independente: Safra, Talhão, Insumo, quantidade, preço — sem relação com Planejamento/Execução.

## API (NestJS) — recursos

Todos sob validação `ValidationPipe` global já existente (`whitelist`, `forbidNonWhitelisted`, `transform`), contratos públicos em `@agro/contracts` (Zod), seguindo o padrão de `health.controller.ts`.

| Recurso          | Endpoints                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| Propriedade      | `GET/POST /propriedades`, `GET/PATCH /propriedades/:id`                                          |
| Talhão           | `GET/POST /propriedades/:id/talhoes`, `GET/PATCH /talhoes/:id`                                   |
| Safra            | `GET/POST /safras`, `GET/PATCH /safras/:id`                                                      |
| Procedimento     | `GET/POST /procedimentos`                                                                        |
| Insumo           | `GET/POST /insumos`, `PATCH /insumos/:id` (atualizar preço atual)                                |
| Planejamento     | `GET/POST /planejamentos` (filtros: safraId, talhaoId, período), `GET /planejamentos/:id`        |
| Execução         | `GET/POST /execucoes` (filtros iguais), vinculada opcionalmente via `planejamentoItemId` no body |
| Compra de Insumo | `GET/POST /compras-insumo`                                                                       |

Sem rotas de `DELETE` nesta fase (histórico de custo não deve sumir); edição via `PATCH` restrita a campos não-financeiros (ex. observação) — campos que afetam custo são imutáveis após criado, para preservar o snapshot.

## Erros e validação

Segue exatamente o padrão já estabelecido no projeto — nada novo:

- Validação de entrada via Zod em `@agro/contracts` + `ValidationPipe` do Nest.
- `talhaoId`/`safraId`/`procedimentoId`/`insumoId` inexistentes ou de outra organização → `404`/`400` (nunca vazamento de dado de outra organização, mesmo sem auth real).
- `dataPrevista`/`data` fora do período da Safra → erro de validação.

## Testes

Por entidade, seguindo o padrão de `apps/api/test/health.test.ts`:

- Contrato Zod aceita payload válido e rejeita payload inválido/campo extra.
- Comportamento no Nest: ex. "não permite Execução referenciar Talhão de Propriedade de outra Organização", "status calculado fica Atrasado quando `dataPrevista` passou sem Execução vinculada", "custoEstimado é a soma correta de dose×área×preço", "preço do Insumo mudar não altera custoEstimado já gravado".

## Próximo passo

Após aprovação desta spec, uso a skill `writing-plans` para gerar o plano de implementação (ordem de criação dos modelos Prisma, migrations, módulos NestJS, contratos Zod, testes). As telas web do Next.js ficam para um plano/spec seguinte.
