# Domínio de Gestão Agrícola — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o domínio de Gestão Agrícola do AGRO (Propriedade/Talhão, Safra, Procedimento, Insumo, Planejamento, Execução, Compra de Insumo) como schema Prisma + API REST NestJS + contratos Zod compartilhados, sem telas Next.js e sem autenticação real.

**Architecture:** Monólito modular NestJS: um módulo por recurso (Propriedades, Talhoes, Safras, Procedimentos, Insumos, Planejamentos, Execucoes, ComprasInsumo), cada um com controller+service+DTO próprios, todos sobre um `PrismaService` global. Contratos de resposta pública em `@agro/contracts` (Zod); validação de entrada via DTOs `class-validator` (convenção já usada pelo `ValidationPipe` existente). Organização é única e implícita, resolvida por um `CurrentOrganizationService` (find-or-create), sem login.

**Tech Stack:** NestJS 11, Prisma 6.19.3 (generator `prisma-client`), PostgreSQL 17, Zod 4, class-validator/class-transformer (já instalados), Jest + Supertest (padrão já usado em `apps/api/test/health.test.ts`).

**Spec:** `docs/superpowers/specs/2026-10-13-gestao-agricola-dominio-design.md`

## Global Constraints

- Node 22.16.x, pnpm 10.34.5 — `pnpm install` já feito, não editar `pnpm-lock.yaml` à mão.
- Branch de trabalho: `dev` (não commitar na `main`).
- Toda entidade com `organizacaoId` resolve a organização via `CurrentOrganizationService.getId()` — nunca aceitar `organizacaoId` vindo do cliente.
- **Contratos Zod em `@agro/contracts` = apenas respostas públicas.** Validação de entrada (POST/PATCH) usa DTOs `class-validator` no NestJS — segue a convenção já usada pelo `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` existente em `apps/api/src/setup.ts`. Não duplicar schemas Zod para request bodies.
- **Precisão decimal (Postgres `@db.Decimal`) — usar exatamente estes valores em todo o schema:**
  - Áreas (`areaHa`): `Decimal(10, 2)` → ex. `"10000.00"`.
  - Preços unitários (`precoUnitarioAtual`, `precoUnitarioSnapshot`): `Decimal(12, 4)` → ex. `"100.0000"`.
  - Doses/quantidades (`dosePorHa`, `quantidade`): `Decimal(12, 4)` → ex. `"0.3500"`.
  - Custos totais (`custoEstimado`, `custoTotal`): `Decimal(14, 2)` → ex. `"70000.00"`.
  - Sacas (`quantidadeColhidaSacas`): `Decimal(12, 2)`.
  - Em TypeScript, usar `Prisma.Decimal` (importado de `../../generated/prisma/client`); converter para `number` via `.toNumber()` só para cálculo, nunca para persistir diretamente um `number` sem passar por `new Prisma.Decimal(...)`.
- **Status do Planejamento é sempre calculado em tempo de leitura, nunca gravado em coluna** — ver Task 9.
- **Sem rotas DELETE nesta fase.** Campos que afetam custo (`custoEstimado`, `custoTotal`, snapshots) são imutáveis após criados — não expor em nenhum DTO de `PATCH`.
- **Isolamento de teste:** todo arquivo de teste que toca o banco deve rodar `await prisma.organizacao.deleteMany()` em `beforeEach` (cascateia e limpa tudo, por causa de `onDelete: Cascade`). Os testes rodam com `jest --runInBand` (sequencial), então isso é suficiente para isolar os arquivos entre si.
- Antes de considerar o plano concluído: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` precisam passar na raiz do monorepo (Task 12).
- Conventional Commits em cada task (`feat(api): ...`, `feat(contracts): ...`).
- `docker compose up -d postgres` deve estar rodando antes de qualquer task que toque o banco (Task 1 em diante). `DATABASE_URL` já configurado em `apps/api/.env`.

---

## Task 1: Schema Prisma — modelos de Gestão Agrícola

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**

- Produces: modelos Prisma `Organizacao`, `Propriedade`, `Talhao`, `Safra`, `Procedimento` (enum `TipoProcedimento`), `Insumo`, `PlanejamentoItem`, `PlanejamentoInsumo`, `ExecucaoItem`, `ExecucaoInsumo`, `CompraInsumo` — consumidos por todas as tasks seguintes via `PrismaService`.

- [ ] **Step 1: Escrever o schema**

Substituir o conteúdo de `apps/api/prisma/schema.prisma` por:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TipoProcedimento {
  APLICACAO
  PLANTIO
  COLHEITA
  IRRIGACAO
  OUTRO
}

model Organizacao {
  id        String   @id @default(cuid())
  nome      String
  createdAt DateTime @default(now())

  propriedades  Propriedade[]
  safras        Safra[]
  procedimentos Procedimento[]
  insumos       Insumo[]
  planejamentos PlanejamentoItem[]
  execucoes     ExecucaoItem[]
  comprasInsumo CompraInsumo[]
}

model Propriedade {
  id            String   @id @default(cuid())
  organizacaoId String
  nome          String
  areaHa        Decimal  @db.Decimal(10, 2)
  createdAt     DateTime @default(now())

  organizacao Organizacao @relation(fields: [organizacaoId], references: [id], onDelete: Cascade)
  talhoes     Talhao[]

  @@index([organizacaoId])
}

model Talhao {
  id            String   @id @default(cuid())
  propriedadeId String
  nome          String
  areaHa        Decimal  @db.Decimal(10, 2)
  createdAt     DateTime @default(now())

  propriedade   Propriedade        @relation(fields: [propriedadeId], references: [id], onDelete: Cascade)
  planejamentos PlanejamentoItem[]
  execucoes     ExecucaoItem[]
  comprasInsumo CompraInsumo[]

  @@index([propriedadeId])
}

model Safra {
  id            String   @id @default(cuid())
  organizacaoId String
  nome          String
  cultura       String
  dataInicio    DateTime
  dataFim       DateTime
  createdAt     DateTime @default(now())

  organizacao   Organizacao        @relation(fields: [organizacaoId], references: [id], onDelete: Cascade)
  planejamentos PlanejamentoItem[]
  execucoes     ExecucaoItem[]
  comprasInsumo CompraInsumo[]

  @@index([organizacaoId])
}

model Procedimento {
  id            String           @id @default(cuid())
  organizacaoId String
  nome          String
  tipo          TipoProcedimento
  createdAt     DateTime         @default(now())

  organizacao   Organizacao        @relation(fields: [organizacaoId], references: [id], onDelete: Cascade)
  planejamentos PlanejamentoItem[]
  execucoes     ExecucaoItem[]

  @@index([organizacaoId])
}

model Insumo {
  id                 String   @id @default(cuid())
  organizacaoId      String
  nome               String
  unidade            String
  precoUnitarioAtual Decimal  @db.Decimal(12, 4)
  createdAt          DateTime @default(now())

  organizacao         Organizacao          @relation(fields: [organizacaoId], references: [id], onDelete: Cascade)
  planejamentoInsumos PlanejamentoInsumo[]
  execucaoInsumos     ExecucaoInsumo[]
  comprasInsumo       CompraInsumo[]

  @@index([organizacaoId])
}

model PlanejamentoItem {
  id             String   @id @default(cuid())
  organizacaoId  String
  safraId        String
  talhaoId       String
  procedimentoId String
  dataPrevista   DateTime
  custoEstimado  Decimal  @db.Decimal(14, 2)
  observacao     String?
  createdAt      DateTime @default(now())

  organizacao  Organizacao          @relation(fields: [organizacaoId], references: [id], onDelete: Cascade)
  safra        Safra                @relation(fields: [safraId], references: [id], onDelete: Cascade)
  talhao       Talhao               @relation(fields: [talhaoId], references: [id], onDelete: Cascade)
  procedimento Procedimento         @relation(fields: [procedimentoId], references: [id], onDelete: Cascade)
  insumos      PlanejamentoInsumo[]
  execucoes    ExecucaoItem[]

  @@index([organizacaoId])
  @@index([safraId])
  @@index([talhaoId])
}

model PlanejamentoInsumo {
  id                    String  @id @default(cuid())
  planejamentoItemId    String
  insumoId              String
  dosePorHa             Decimal @db.Decimal(12, 4)
  precoUnitarioSnapshot Decimal @db.Decimal(12, 4)

  planejamentoItem PlanejamentoItem @relation(fields: [planejamentoItemId], references: [id], onDelete: Cascade)
  insumo           Insumo           @relation(fields: [insumoId], references: [id], onDelete: Cascade)

  @@index([planejamentoItemId])
}

model ExecucaoItem {
  id                     String    @id @default(cuid())
  organizacaoId          String
  safraId                String
  talhaoId               String
  procedimentoId         String
  planejamentoItemId     String?
  data                   DateTime
  custoTotal             Decimal   @db.Decimal(14, 2)
  operador               String?
  maquina                String?
  quantidadeColhidaSacas Decimal?  @db.Decimal(12, 2)
  observacao             String?
  createdAt              DateTime  @default(now())

  organizacao      Organizacao       @relation(fields: [organizacaoId], references: [id], onDelete: Cascade)
  safra            Safra             @relation(fields: [safraId], references: [id], onDelete: Cascade)
  talhao           Talhao            @relation(fields: [talhaoId], references: [id], onDelete: Cascade)
  procedimento     Procedimento      @relation(fields: [procedimentoId], references: [id], onDelete: Cascade)
  planejamentoItem PlanejamentoItem? @relation(fields: [planejamentoItemId], references: [id], onDelete: SetNull)
  insumos          ExecucaoInsumo[]

  @@index([organizacaoId])
  @@index([safraId])
  @@index([talhaoId])
  @@index([planejamentoItemId])
}

model ExecucaoInsumo {
  id                    String  @id @default(cuid())
  execucaoItemId        String
  insumoId              String
  quantidade            Decimal @db.Decimal(12, 4)
  precoUnitarioSnapshot Decimal @db.Decimal(12, 4)

  execucaoItem ExecucaoItem @relation(fields: [execucaoItemId], references: [id], onDelete: Cascade)
  insumo       Insumo       @relation(fields: [insumoId], references: [id], onDelete: Cascade)

  @@index([execucaoItemId])
}

model CompraInsumo {
  id                    String   @id @default(cuid())
  organizacaoId         String
  talhaoId              String
  safraId               String
  insumoId              String
  data                  DateTime
  quantidade            Decimal  @db.Decimal(12, 4)
  precoUnitarioSnapshot Decimal  @db.Decimal(12, 4)
  custoTotal            Decimal  @db.Decimal(14, 2)
  createdAt             DateTime @default(now())

  organizacao Organizacao @relation(fields: [organizacaoId], references: [id], onDelete: Cascade)
  talhao      Talhao      @relation(fields: [talhaoId], references: [id], onDelete: Cascade)
  safra       Safra       @relation(fields: [safraId], references: [id], onDelete: Cascade)
  insumo      Insumo      @relation(fields: [insumoId], references: [id], onDelete: Cascade)

  @@index([organizacaoId])
  @@index([talhaoId])
  @@index([safraId])
}
```

- [ ] **Step 2: Validar o schema**

Run: `pnpm --filter @agro/api db:validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Criar e aplicar a migration (precisa do Postgres rodando: `docker compose up -d postgres`)**

Run: `pnpm --filter @agro/api db:migrate --name add_gestao_agricola_dominio`
Expected: cria `apps/api/prisma/migrations/<timestamp>_add_gestao_agricola_dominio/migration.sql` e aplica no banco local sem erro.

- [ ] **Step 4: Regenerar o client**

Run: `pnpm db:generate`
Expected: `Generated Prisma Client (6.19.3) to ./generated/prisma`

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(db): adiciona schema de Gestão Agrícola (Propriedade, Talhão, Safra, Procedimento, Insumo, Planejamento, Execução, CompraInsumo)"
```

---

## Task 2: PrismaService + PrismaModule

**Files:**

- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `PrismaClient` de `../../generated/prisma/client` (Task 1).
- Produces: `PrismaService` (injetável, global) — todas as tasks seguintes injetam `PrismaService` no construtor dos seus services.

- [ ] **Step 1: Escrever PrismaService**

`apps/api/src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

`apps/api/src/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 2: Registrar no AppModule**

Editar `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 3: Confirmar que compila**

Run: `pnpm --filter @agro/api build`
Expected: build sem erros (a conectividade real do Prisma é verificada pelo teste da Task 3).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/prisma apps/api/src/app.module.ts
git commit -m "feat(api): adiciona PrismaService global"
```

---

## Task 3: CurrentOrganizationService

**Files:**

- Create: `apps/api/src/organizacao/current-organization.service.ts`
- Create: `apps/api/src/organizacao/organizacao.module.ts`
- Create: `apps/api/test/organizacao.test.ts`

**Interfaces:**

- Consumes: `PrismaService` (Task 2).
- Produces: `CurrentOrganizationService.getId(): Promise<string>` — toda task de 4 a 11 importa `OrganizacaoModule` e injeta este serviço para resolver `organizacaoId`.

- [ ] **Step 1: Escrever o teste (que vai falhar — os arquivos ainda não existem)**

`apps/api/test/organizacao.test.ts`:

```ts
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrganizacaoModule } from '../src/organizacao/organizacao.module';
import { CurrentOrganizationService } from '../src/organizacao/current-organization.service';

describe('CurrentOrganizationService', () => {
  let prisma: PrismaService;
  let service: CurrentOrganizationService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule, OrganizacaoModule],
    }).compile();
    prisma = module.get(PrismaService);
    service = module.get(CurrentOrganizationService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.organizacao.deleteMany();
  });

  it('creates the default organization when none exists', async () => {
    const id = await service.getId();
    const all = await prisma.organizacao.findMany();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(id);
  });

  it('reuses the existing organization instead of creating a second one', async () => {
    const first = await service.getId();
    const second = await service.getId();
    expect(second).toBe(first);
    const all = await prisma.organizacao.findMany();
    expect(all).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @agro/api test -- organizacao.test`
Expected: FAIL com `Cannot find module '../src/organizacao/organizacao.module'`

- [ ] **Step 3: Implementar**

`apps/api/src/organizacao/current-organization.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CurrentOrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getId(): Promise<string> {
    const existing = await this.prisma.organizacao.findFirst();
    if (existing) return existing.id;
    const created = await this.prisma.organizacao.create({
      data: { nome: 'Organização Padrão' },
    });
    return created.id;
  }
}
```

`apps/api/src/organizacao/organizacao.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CurrentOrganizationService } from './current-organization.service';

@Module({
  providers: [CurrentOrganizationService],
  exports: [CurrentOrganizationService],
})
export class OrganizacaoModule {}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @agro/api test -- organizacao.test`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/organizacao apps/api/test/organizacao.test.ts
git commit -m "feat(api): adiciona CurrentOrganizationService (organização única, find-or-create)"
```

---

## Task 4: Propriedade (contrato + API)

**Files:**

- Create: `packages/contracts/src/propriedade.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/propriedades/propriedades.dto.ts`
- Create: `apps/api/src/propriedades/propriedades.service.ts`
- Create: `apps/api/src/propriedades/propriedades.controller.ts`
- Create: `apps/api/src/propriedades/propriedades.module.ts`
- Create: `apps/api/test/propriedades.test.ts`
- Modify: `apps/api/test/health.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `PrismaService`, `CurrentOrganizationService` (Tasks 2-3).
- Produces: `PropriedadeResponse` (tipo de `@agro/contracts`), `PropriedadesService` (injetado pela Task 5 — `TalhoesService` usa `PrismaService` diretamente para checar a propriedade, não precisa importar `PropriedadesService`).

- [ ] **Step 1: Escrever o contrato e o teste (vão falhar — nada existe ainda)**

`packages/contracts/src/propriedade.ts`:

```ts
import { z } from 'zod';

export const propriedadeResponseSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    areaHa: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type PropriedadeResponse = z.infer<typeof propriedadeResponseSchema>;
```

Adicionar ao final de `packages/contracts/src/index.ts`:

```ts
export * from './propriedade';
```

`apps/api/test/propriedades.test.ts`:

```ts
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Propriedades', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.organizacao.deleteMany();
  });

  it('creates and lists a propriedade', async () => {
    const created = await request(app.getHttpServer())
      .post('/propriedades')
      .send({ nome: 'Fazenda Esperança', areaHa: 10000 })
      .expect(201);
    expect(created.body).toMatchObject({
      nome: 'Fazenda Esperança',
      areaHa: '10000.00',
    });

    const list = await request(app.getHttpServer())
      .get('/propriedades')
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  it('rejects creation with missing fields', async () => {
    await request(app.getHttpServer())
      .post('/propriedades')
      .send({ nome: 'Sem área' })
      .expect(400);
  });

  it('returns 404 for unknown propriedade', async () => {
    await request(app.getHttpServer())
      .get('/propriedades/unknown-id')
      .expect(404);
  });

  it('updates an existing propriedade', async () => {
    const created = await request(app.getHttpServer())
      .post('/propriedades')
      .send({ nome: 'Fazenda Vitória', areaHa: 4000 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/propriedades/${created.body.id}`)
      .send({ nome: 'Fazenda Vitória', areaHa: 4500 })
      .expect(200);
    expect(updated.body.areaHa).toBe('4500.00');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @agro/api test -- propriedades.test`
Expected: FAIL com `Cannot find module '../src/propriedades/...'` (rotas ainda não existem)

- [ ] **Step 3: Implementar**

`apps/api/src/propriedades/propriedades.dto.ts`:

```ts
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePropriedadeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  areaHa!: number;
}

export class UpdatePropriedadeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  areaHa!: number;
}
```

`apps/api/src/propriedades/propriedades.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { PropriedadeResponse } from '@agro/contracts';
import { Prisma } from '../../generated/prisma/client';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePropriedadeDto,
  UpdatePropriedadeDto,
} from './propriedades.dto';

type PropriedadeRow = {
  id: string;
  nome: string;
  areaHa: Prisma.Decimal;
  createdAt: Date;
};

@Injectable()
export class PropriedadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(propriedade: PropriedadeRow): PropriedadeResponse {
    return {
      id: propriedade.id,
      nome: propriedade.nome,
      areaHa: propriedade.areaHa.toString(),
      createdAt: propriedade.createdAt.toISOString(),
    };
  }

  async list(): Promise<PropriedadeResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const propriedades = await this.prisma.propriedade.findMany({
      where: { organizacaoId },
      orderBy: { createdAt: 'asc' },
    });
    return propriedades.map((p) => this.toResponse(p));
  }

  async create(dto: CreatePropriedadeDto): Promise<PropriedadeResponse> {
    const organizacaoId = await this.currentOrg.getId();
    const propriedade = await this.prisma.propriedade.create({
      data: {
        organizacaoId,
        nome: dto.nome,
        areaHa: new Prisma.Decimal(dto.areaHa),
      },
    });
    return this.toResponse(propriedade);
  }

  async getOrThrow(id: string): Promise<PropriedadeRow> {
    const propriedade = await this.prisma.propriedade.findUnique({
      where: { id },
    });
    if (!propriedade) throw new NotFoundException('Propriedade não encontrada');
    return propriedade;
  }

  async getById(id: string): Promise<PropriedadeResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async update(
    id: string,
    dto: UpdatePropriedadeDto,
  ): Promise<PropriedadeResponse> {
    await this.getOrThrow(id);
    const propriedade = await this.prisma.propriedade.update({
      where: { id },
      data: { nome: dto.nome, areaHa: new Prisma.Decimal(dto.areaHa) },
    });
    return this.toResponse(propriedade);
  }
}
```

`apps/api/src/propriedades/propriedades.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreatePropriedadeDto, UpdatePropriedadeDto } from './propriedades.dto';
import { PropriedadesService } from './propriedades.service';

@ApiTags('propriedades')
@Controller('propriedades')
export class PropriedadesController {
  constructor(private readonly service: PropriedadesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreatePropriedadeDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePropriedadeDto) {
    return this.service.update(id, dto);
  }
}
```

`apps/api/src/propriedades/propriedades.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { PropriedadesController } from './propriedades.controller';
import { PropriedadesService } from './propriedades.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [PropriedadesController],
  providers: [PropriedadesService],
  exports: [PropriedadesService],
})
export class PropriedadesModule {}
```

Editar `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { PropriedadesModule } from './propriedades/propriedades.module';

@Module({
  imports: [PrismaModule, PropriedadesModule],
  controllers: [HealthController],
})
export class AppModule {}
```

**Atualizar `apps/api/test/health.test.ts`** — a asserção `toEqual(['/health'])` parava de valer a partir de agora que existem rotas de domínio. Trocar o teste `'publishes only health in OpenAPI'`:

```ts
it('publishes health alongside domain routes in OpenAPI', async () => {
  const response = await request(app.getHttpServer())
    .get('/docs-json')
    .expect(200);
  expect(response.body.paths).toHaveProperty('/health');
});
```

(mantém as outras asserções do arquivo intactas, incluindo `'has no invented routes'` que continua testando `/customers`).

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @agro/api test`
Expected: PASS em `health.test.ts` e `propriedades.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/propriedade.ts packages/contracts/src/index.ts apps/api/src/propriedades apps/api/src/app.module.ts apps/api/test/propriedades.test.ts apps/api/test/health.test.ts
git commit -m "feat(api): adiciona recurso Propriedade (CRUD)"
```

---

## Task 5: Talhão (nested em Propriedade)

**Files:**

- Create: `packages/contracts/src/talhao.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/talhoes/talhoes.dto.ts`
- Create: `apps/api/src/talhoes/talhoes.service.ts`
- Create: `apps/api/src/talhoes/talhoes.controller.ts`
- Create: `apps/api/src/talhoes/talhoes.module.ts`
- Create: `apps/api/test/talhoes.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `PrismaService` (Task 2).
- Produces: `TalhaoResponse` (`@agro/contracts`) — consumido pelas respostas de Planejamento/Execução/CompraInsumo (Tasks 9-11) só por `talhaoId: string`, não há dependência direta de código.

- [ ] **Step 1: Escrever o contrato e o teste**

`packages/contracts/src/talhao.ts`:

```ts
import { z } from 'zod';

export const talhaoResponseSchema = z
  .object({
    id: z.string(),
    propriedadeId: z.string(),
    nome: z.string(),
    areaHa: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type TalhaoResponse = z.infer<typeof talhaoResponseSchema>;
```

Adicionar a `packages/contracts/src/index.ts`:

```ts
export * from './talhao';
```

`apps/api/test/talhoes.test.ts`:

```ts
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Talhões', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.organizacao.deleteMany();
  });

  async function criarPropriedade() {
    const response = await request(app.getHttpServer())
      .post('/propriedades')
      .send({ nome: 'Fazenda Esperança', areaHa: 10000 })
      .expect(201);
    return response.body;
  }

  it('creates and lists talhões de uma propriedade', async () => {
    const propriedade = await criarPropriedade();

    const created = await request(app.getHttpServer())
      .post(`/propriedades/${propriedade.id}/talhoes`)
      .send({ nome: 'Talhão 1', areaHa: 2000 })
      .expect(201);
    expect(created.body).toMatchObject({
      propriedadeId: propriedade.id,
      nome: 'Talhão 1',
      areaHa: '2000.00',
    });

    const list = await request(app.getHttpServer())
      .get(`/propriedades/${propriedade.id}/talhoes`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects talhão for an unknown propriedade', async () => {
    await request(app.getHttpServer())
      .post('/propriedades/nao-existe/talhoes')
      .send({ nome: 'Talhão 1', areaHa: 2000 })
      .expect(404);
  });

  it('gets and updates a talhão by id', async () => {
    const propriedade = await criarPropriedade();
    const created = await request(app.getHttpServer())
      .post(`/propriedades/${propriedade.id}/talhoes`)
      .send({ nome: 'Talhão 1', areaHa: 2000 })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/talhoes/${created.body.id}`)
      .expect(200);

    const updated = await request(app.getHttpServer())
      .patch(`/talhoes/${created.body.id}`)
      .send({ nome: 'Talhão 1A', areaHa: 2500 })
      .expect(200);
    expect(updated.body).toMatchObject({
      nome: 'Talhão 1A',
      areaHa: '2500.00',
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @agro/api test -- talhoes.test`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Implementar**

`apps/api/src/talhoes/talhoes.dto.ts`:

```ts
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTalhaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  areaHa!: number;
}

export class UpdateTalhaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  areaHa!: number;
}
```

`apps/api/src/talhoes/talhoes.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { TalhaoResponse } from '@agro/contracts';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTalhaoDto, UpdateTalhaoDto } from './talhoes.dto';

type TalhaoRow = {
  id: string;
  propriedadeId: string;
  nome: string;
  areaHa: Prisma.Decimal;
  createdAt: Date;
};

@Injectable()
export class TalhoesService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(talhao: TalhaoRow): TalhaoResponse {
    return {
      id: talhao.id,
      propriedadeId: talhao.propriedadeId,
      nome: talhao.nome,
      areaHa: talhao.areaHa.toString(),
      createdAt: talhao.createdAt.toISOString(),
    };
  }

  private async getPropriedadeOrThrow(propriedadeId: string) {
    const propriedade = await this.prisma.propriedade.findUnique({
      where: { id: propriedadeId },
    });
    if (!propriedade) throw new NotFoundException('Propriedade não encontrada');
    return propriedade;
  }

  async list(propriedadeId: string): Promise<TalhaoResponse[]> {
    await this.getPropriedadeOrThrow(propriedadeId);
    const talhoes = await this.prisma.talhao.findMany({
      where: { propriedadeId },
      orderBy: { createdAt: 'asc' },
    });
    return talhoes.map((t) => this.toResponse(t));
  }

  async create(
    propriedadeId: string,
    dto: CreateTalhaoDto,
  ): Promise<TalhaoResponse> {
    await this.getPropriedadeOrThrow(propriedadeId);
    const talhao = await this.prisma.talhao.create({
      data: {
        propriedadeId,
        nome: dto.nome,
        areaHa: new Prisma.Decimal(dto.areaHa),
      },
    });
    return this.toResponse(talhao);
  }

  async getOrThrow(id: string): Promise<TalhaoRow> {
    const talhao = await this.prisma.talhao.findUnique({ where: { id } });
    if (!talhao) throw new NotFoundException('Talhão não encontrado');
    return talhao;
  }

  async getById(id: string): Promise<TalhaoResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async update(id: string, dto: UpdateTalhaoDto): Promise<TalhaoResponse> {
    await this.getOrThrow(id);
    const talhao = await this.prisma.talhao.update({
      where: { id },
      data: { nome: dto.nome, areaHa: new Prisma.Decimal(dto.areaHa) },
    });
    return this.toResponse(talhao);
  }
}
```

`apps/api/src/talhoes/talhoes.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateTalhaoDto, UpdateTalhaoDto } from './talhoes.dto';
import { TalhoesService } from './talhoes.service';

@ApiTags('talhoes')
@Controller()
export class TalhoesController {
  constructor(private readonly service: TalhoesService) {}

  @Post('propriedades/:propriedadeId/talhoes')
  create(
    @Param('propriedadeId') propriedadeId: string,
    @Body() dto: CreateTalhaoDto,
  ) {
    return this.service.create(propriedadeId, dto);
  }

  @Get('propriedades/:propriedadeId/talhoes')
  list(@Param('propriedadeId') propriedadeId: string) {
    return this.service.list(propriedadeId);
  }

  @Get('talhoes/:id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch('talhoes/:id')
  update(@Param('id') id: string, @Body() dto: UpdateTalhaoDto) {
    return this.service.update(id, dto);
  }
}
```

`apps/api/src/talhoes/talhoes.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TalhoesController } from './talhoes.controller';
import { TalhoesService } from './talhoes.service';

@Module({
  controllers: [TalhoesController],
  providers: [TalhoesService],
  exports: [TalhoesService],
})
export class TalhoesModule {}
```

Editar `apps/api/src/app.module.ts` — adicionar `TalhoesModule` ao array `imports`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @agro/api test`
Expected: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/talhao.ts packages/contracts/src/index.ts apps/api/src/talhoes apps/api/src/app.module.ts apps/api/test/talhoes.test.ts
git commit -m "feat(api): adiciona recurso Talhão (aninhado em Propriedade)"
```

---

## Task 6: Safra

**Files:**

- Create: `packages/contracts/src/safra.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/safras/safras.dto.ts`
- Create: `apps/api/src/safras/safras.service.ts`
- Create: `apps/api/src/safras/safras.controller.ts`
- Create: `apps/api/src/safras/safras.module.ts`
- Create: `apps/api/test/safras.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `PrismaService`, `CurrentOrganizationService`.
- Produces: `SafraResponse` (`@agro/contracts`).

- [ ] **Step 1: Escrever o contrato e o teste**

`packages/contracts/src/safra.ts`:

```ts
import { z } from 'zod';

export const safraResponseSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    cultura: z.string(),
    dataInicio: z.iso.datetime(),
    dataFim: z.iso.datetime(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type SafraResponse = z.infer<typeof safraResponseSchema>;
```

Adicionar a `packages/contracts/src/index.ts`:

```ts
export * from './safra';
```

`apps/api/test/safras.test.ts`:

```ts
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Safras', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.organizacao.deleteMany();
  });

  it('creates and lists a safra', async () => {
    const created = await request(app.getHttpServer())
      .post('/safras')
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      nome: 'Colheitas 25/26 Soja',
      cultura: 'Soja',
    });

    const list = await request(app.getHttpServer()).get('/safras').expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects dataFim before dataInicio', async () => {
    await request(app.getHttpServer())
      .post('/safras')
      .send({
        nome: 'Safra inválida',
        cultura: 'Soja',
        dataInicio: '2026-06-01T00:00:00.000Z',
        dataFim: '2025-06-01T00:00:00.000Z',
      })
      .expect(400);
  });

  it('updates an existing safra', async () => {
    const created = await request(app.getHttpServer())
      .post('/safras')
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/safras/${created.body.id}`)
      .send({
        nome: 'Colheitas 25/26 Soja (revisada)',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-07-01T00:00:00.000Z',
      })
      .expect(200);
    expect(updated.body.nome).toBe('Colheitas 25/26 Soja (revisada)');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @agro/api test -- safras.test`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Implementar**

`apps/api/src/safras/safras.dto.ts`:

```ts
import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'DataFimAposDataInicio', async: false })
class DataFimAposDataInicioConstraint implements ValidatorConstraintInterface {
  validate(dataFim: string, args: { object: { dataInicio?: string } }) {
    if (!args.object.dataInicio) return true;
    return (
      new Date(dataFim).getTime() > new Date(args.object.dataInicio).getTime()
    );
  }
  defaultMessage() {
    return 'dataFim deve ser posterior a dataInicio';
  }
}

export class CreateSafraDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  cultura!: string;

  @IsISO8601()
  dataInicio!: string;

  @IsISO8601()
  @Validate(DataFimAposDataInicioConstraint)
  dataFim!: string;
}

export class UpdateSafraDto extends CreateSafraDto {}
```

`apps/api/src/safras/safras.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { SafraResponse } from '@agro/contracts';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSafraDto, UpdateSafraDto } from './safras.dto';

type SafraRow = {
  id: string;
  nome: string;
  cultura: string;
  dataInicio: Date;
  dataFim: Date;
  createdAt: Date;
};

@Injectable()
export class SafrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(safra: SafraRow): SafraResponse {
    return {
      id: safra.id,
      nome: safra.nome,
      cultura: safra.cultura,
      dataInicio: safra.dataInicio.toISOString(),
      dataFim: safra.dataFim.toISOString(),
      createdAt: safra.createdAt.toISOString(),
    };
  }

  async list(): Promise<SafraResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const safras = await this.prisma.safra.findMany({
      where: { organizacaoId },
      orderBy: { createdAt: 'asc' },
    });
    return safras.map((s) => this.toResponse(s));
  }

  async create(dto: CreateSafraDto): Promise<SafraResponse> {
    const organizacaoId = await this.currentOrg.getId();
    const safra = await this.prisma.safra.create({
      data: {
        organizacaoId,
        nome: dto.nome,
        cultura: dto.cultura,
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
      },
    });
    return this.toResponse(safra);
  }

  async getOrThrow(id: string): Promise<SafraRow> {
    const safra = await this.prisma.safra.findUnique({ where: { id } });
    if (!safra) throw new NotFoundException('Safra não encontrada');
    return safra;
  }

  async getById(id: string): Promise<SafraResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async update(id: string, dto: UpdateSafraDto): Promise<SafraResponse> {
    await this.getOrThrow(id);
    const safra = await this.prisma.safra.update({
      where: { id },
      data: {
        nome: dto.nome,
        cultura: dto.cultura,
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
      },
    });
    return this.toResponse(safra);
  }
}
```

`apps/api/src/safras/safras.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateSafraDto, UpdateSafraDto } from './safras.dto';
import { SafrasService } from './safras.service';

@ApiTags('safras')
@Controller('safras')
export class SafrasController {
  constructor(private readonly service: SafrasService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateSafraDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSafraDto) {
    return this.service.update(id, dto);
  }
}
```

`apps/api/src/safras/safras.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { SafrasController } from './safras.controller';
import { SafrasService } from './safras.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [SafrasController],
  providers: [SafrasService],
  exports: [SafrasService],
})
export class SafrasModule {}
```

Editar `apps/api/src/app.module.ts` — adicionar `SafrasModule` ao array `imports`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @agro/api test`
Expected: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/safra.ts packages/contracts/src/index.ts apps/api/src/safras apps/api/src/app.module.ts apps/api/test/safras.test.ts
git commit -m "feat(api): adiciona recurso Safra"
```

---

## Task 7: Procedimento

**Files:**

- Create: `packages/contracts/src/procedimento.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/procedimentos/procedimentos.dto.ts`
- Create: `apps/api/src/procedimentos/procedimentos.service.ts`
- Create: `apps/api/src/procedimentos/procedimentos.controller.ts`
- Create: `apps/api/src/procedimentos/procedimentos.module.ts`
- Create: `apps/api/test/procedimentos.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `PrismaService`, `CurrentOrganizationService`, enum `TipoProcedimento` (Task 1).
- Produces: `ProcedimentoResponse` (`@agro/contracts`) — usado pelas Tasks 9 e 10 para validar `procedimentoId` e checar `tipo === 'COLHEITA'`.

- [ ] **Step 1: Escrever o contrato e o teste**

`packages/contracts/src/procedimento.ts`:

```ts
import { z } from 'zod';

export const tipoProcedimentoSchema = z.enum([
  'APLICACAO',
  'PLANTIO',
  'COLHEITA',
  'IRRIGACAO',
  'OUTRO',
]);

export const procedimentoResponseSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    tipo: tipoProcedimentoSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();

export type TipoProcedimento = z.infer<typeof tipoProcedimentoSchema>;
export type ProcedimentoResponse = z.infer<typeof procedimentoResponseSchema>;
```

Adicionar a `packages/contracts/src/index.ts`:

```ts
export * from './procedimento';
```

`apps/api/test/procedimentos.test.ts`:

```ts
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Procedimentos', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.organizacao.deleteMany();
  });

  it('creates and lists a procedimento', async () => {
    const created = await request(app.getHttpServer())
      .post('/procedimentos')
      .send({ nome: '1ª Aplicação de Fungicida', tipo: 'APLICACAO' })
      .expect(201);
    expect(created.body).toMatchObject({
      nome: '1ª Aplicação de Fungicida',
      tipo: 'APLICACAO',
    });

    const list = await request(app.getHttpServer())
      .get('/procedimentos')
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects an unknown tipo', async () => {
    await request(app.getHttpServer())
      .post('/procedimentos')
      .send({ nome: 'Procedimento inválido', tipo: 'NAO_EXISTE' })
      .expect(400);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @agro/api test -- procedimentos.test`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Implementar**

`apps/api/src/procedimentos/procedimentos.dto.ts`:

```ts
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TipoProcedimento } from '../../generated/prisma/client';

export class CreateProcedimentoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nome!: string;

  @IsEnum(TipoProcedimento)
  tipo!: TipoProcedimento;
}
```

`apps/api/src/procedimentos/procedimentos.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProcedimentoResponse } from '@agro/contracts';
import { TipoProcedimento } from '../../generated/prisma/client';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateProcedimentoDto } from './procedimentos.dto';

type ProcedimentoRow = {
  id: string;
  nome: string;
  tipo: TipoProcedimento;
  createdAt: Date;
};

@Injectable()
export class ProcedimentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(procedimento: ProcedimentoRow): ProcedimentoResponse {
    return {
      id: procedimento.id,
      nome: procedimento.nome,
      tipo: procedimento.tipo,
      createdAt: procedimento.createdAt.toISOString(),
    };
  }

  async list(): Promise<ProcedimentoResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const procedimentos = await this.prisma.procedimento.findMany({
      where: { organizacaoId },
      orderBy: { createdAt: 'asc' },
    });
    return procedimentos.map((p) => this.toResponse(p));
  }

  async create(dto: CreateProcedimentoDto): Promise<ProcedimentoResponse> {
    const organizacaoId = await this.currentOrg.getId();
    const procedimento = await this.prisma.procedimento.create({
      data: { organizacaoId, nome: dto.nome, tipo: dto.tipo },
    });
    return this.toResponse(procedimento);
  }

  async getOrThrow(id: string): Promise<ProcedimentoRow> {
    const procedimento = await this.prisma.procedimento.findUnique({
      where: { id },
    });
    if (!procedimento)
      throw new NotFoundException('Procedimento não encontrado');
    return procedimento;
  }
}
```

`apps/api/src/procedimentos/procedimentos.controller.ts`:

```ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateProcedimentoDto } from './procedimentos.dto';
import { ProcedimentosService } from './procedimentos.service';

@ApiTags('procedimentos')
@Controller('procedimentos')
export class ProcedimentosController {
  constructor(private readonly service: ProcedimentosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateProcedimentoDto) {
    return this.service.create(dto);
  }
}
```

`apps/api/src/procedimentos/procedimentos.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { ProcedimentosController } from './procedimentos.controller';
import { ProcedimentosService } from './procedimentos.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [ProcedimentosController],
  providers: [ProcedimentosService],
  exports: [ProcedimentosService],
})
export class ProcedimentosModule {}
```

Editar `apps/api/src/app.module.ts` — adicionar `ProcedimentosModule` ao array `imports`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @agro/api test`
Expected: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/procedimento.ts packages/contracts/src/index.ts apps/api/src/procedimentos apps/api/src/app.module.ts apps/api/test/procedimentos.test.ts
git commit -m "feat(api): adiciona recurso Procedimento"
```

---

## Task 8: Insumo

**Files:**

- Create: `packages/contracts/src/insumo.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/insumos/insumos.dto.ts`
- Create: `apps/api/src/insumos/insumos.service.ts`
- Create: `apps/api/src/insumos/insumos.controller.ts`
- Create: `apps/api/src/insumos/insumos.module.ts`
- Create: `apps/api/test/insumos.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `PrismaService`, `CurrentOrganizationService`.
- Produces: `InsumoResponse` (`@agro/contracts`) — Tasks 9, 10 e 11 usam `insumo.precoUnitarioAtual` (lido direto via `PrismaService`, não via este service) para calcular snapshots de custo.

- [ ] **Step 1: Escrever o contrato e o teste**

`packages/contracts/src/insumo.ts`:

```ts
import { z } from 'zod';

export const insumoResponseSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    unidade: z.string(),
    precoUnitarioAtual: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type InsumoResponse = z.infer<typeof insumoResponseSchema>;
```

Adicionar a `packages/contracts/src/index.ts`:

```ts
export * from './insumo';
```

`apps/api/test/insumos.test.ts`:

```ts
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Insumos', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.organizacao.deleteMany();
  });

  it('creates and lists an insumo', async () => {
    const created = await request(app.getHttpServer())
      .post('/insumos')
      .send({ nome: 'Fox Supra', unidade: 'litro', precoUnitarioAtual: 100 })
      .expect(201);
    expect(created.body).toMatchObject({
      nome: 'Fox Supra',
      unidade: 'litro',
      precoUnitarioAtual: '100.0000',
    });

    const list = await request(app.getHttpServer()).get('/insumos').expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('updates the preço unitário atual de um insumo', async () => {
    const created = await request(app.getHttpServer())
      .post('/insumos')
      .send({ nome: 'Fox Supra', unidade: 'litro', precoUnitarioAtual: 100 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/insumos/${created.body.id}`)
      .send({ precoUnitarioAtual: 110.5 })
      .expect(200);
    expect(updated.body.precoUnitarioAtual).toBe('110.5000');
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @agro/api test -- insumos.test`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Implementar**

`apps/api/src/insumos/insumos.dto.ts`:

```ts
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateInsumoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  unidade!: string;

  @IsNumber()
  @IsPositive()
  precoUnitarioAtual!: number;
}

export class UpdateInsumoPrecoDto {
  @IsNumber()
  @IsPositive()
  precoUnitarioAtual!: number;
}
```

`apps/api/src/insumos/insumos.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { InsumoResponse } from '@agro/contracts';
import { Prisma } from '../../generated/prisma/client';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInsumoDto, UpdateInsumoPrecoDto } from './insumos.dto';

type InsumoRow = {
  id: string;
  nome: string;
  unidade: string;
  precoUnitarioAtual: Prisma.Decimal;
  createdAt: Date;
};

@Injectable()
export class InsumosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(insumo: InsumoRow): InsumoResponse {
    return {
      id: insumo.id,
      nome: insumo.nome,
      unidade: insumo.unidade,
      precoUnitarioAtual: insumo.precoUnitarioAtual.toString(),
      createdAt: insumo.createdAt.toISOString(),
    };
  }

  async list(): Promise<InsumoResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const insumos = await this.prisma.insumo.findMany({
      where: { organizacaoId },
      orderBy: { createdAt: 'asc' },
    });
    return insumos.map((i) => this.toResponse(i));
  }

  async create(dto: CreateInsumoDto): Promise<InsumoResponse> {
    const organizacaoId = await this.currentOrg.getId();
    const insumo = await this.prisma.insumo.create({
      data: {
        organizacaoId,
        nome: dto.nome,
        unidade: dto.unidade,
        precoUnitarioAtual: new Prisma.Decimal(dto.precoUnitarioAtual),
      },
    });
    return this.toResponse(insumo);
  }

  async getOrThrow(id: string): Promise<InsumoRow> {
    const insumo = await this.prisma.insumo.findUnique({ where: { id } });
    if (!insumo) throw new NotFoundException('Insumo não encontrado');
    return insumo;
  }

  async updatePreco(
    id: string,
    dto: UpdateInsumoPrecoDto,
  ): Promise<InsumoResponse> {
    await this.getOrThrow(id);
    const insumo = await this.prisma.insumo.update({
      where: { id },
      data: { precoUnitarioAtual: new Prisma.Decimal(dto.precoUnitarioAtual) },
    });
    return this.toResponse(insumo);
  }
}
```

`apps/api/src/insumos/insumos.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateInsumoDto, UpdateInsumoPrecoDto } from './insumos.dto';
import { InsumosService } from './insumos.service';

@ApiTags('insumos')
@Controller('insumos')
export class InsumosController {
  constructor(private readonly service: InsumosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateInsumoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  updatePreco(@Param('id') id: string, @Body() dto: UpdateInsumoPrecoDto) {
    return this.service.updatePreco(id, dto);
  }
}
```

`apps/api/src/insumos/insumos.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { InsumosController } from './insumos.controller';
import { InsumosService } from './insumos.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [InsumosController],
  providers: [InsumosService],
  exports: [InsumosService],
})
export class InsumosModule {}
```

Editar `apps/api/src/app.module.ts` — adicionar `InsumosModule` ao array `imports`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @agro/api test`
Expected: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/insumo.ts packages/contracts/src/index.ts apps/api/src/insumos apps/api/src/app.module.ts apps/api/test/insumos.test.ts
git commit -m "feat(api): adiciona recurso Insumo"
```

---

## Task 9: Planejamento (PlanejamentoItem + PlanejamentoInsumo + status calculado)

**Files:**

- Create: `packages/contracts/src/planejamento.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/common/list-filters.dto.ts`
- Create: `apps/api/src/planejamentos/planejamentos.dto.ts`
- Create: `apps/api/src/planejamentos/planejamentos.service.ts`
- Create: `apps/api/src/planejamentos/planejamentos.controller.ts`
- Create: `apps/api/src/planejamentos/planejamentos.module.ts`
- Create: `apps/api/test/support/fixtures.ts`
- Create: `apps/api/test/planejamentos.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `PrismaService`, `CurrentOrganizationService`, modelos `Safra`/`Talhao`/`Procedimento`/`Insumo` (Tasks 5-8).
- Produces: `PlanejamentoResponse`, `PlanejamentoStatus` (`'PLANEJADO' | 'ATRASADO' | 'EXECUTADO'`) (`@agro/contracts`); `ListFiltersDto` (`apps/api/src/common/list-filters.dto.ts`) — reaproveitado pela Task 10 e 11; `criarFixturesAgricolas(app)` (`apps/api/test/support/fixtures.ts`) — reaproveitado pelas Tasks 10 e 11.

- [ ] **Step 1: Escrever o contrato, os helpers de teste e o teste**

`packages/contracts/src/planejamento.ts`:

```ts
import { z } from 'zod';

export const planejamentoStatusSchema = z.enum([
  'PLANEJADO',
  'ATRASADO',
  'EXECUTADO',
]);

export const planejamentoInsumoResponseSchema = z
  .object({
    insumoId: z.string(),
    dosePorHa: z.string(),
    precoUnitarioSnapshot: z.string(),
  })
  .strict();

export const planejamentoResponseSchema = z
  .object({
    id: z.string(),
    safraId: z.string(),
    talhaoId: z.string(),
    procedimentoId: z.string(),
    dataPrevista: z.iso.datetime(),
    custoEstimado: z.string(),
    observacao: z.string().nullable(),
    status: planejamentoStatusSchema,
    insumos: z.array(planejamentoInsumoResponseSchema),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type PlanejamentoStatus = z.infer<typeof planejamentoStatusSchema>;
export type PlanejamentoResponse = z.infer<typeof planejamentoResponseSchema>;
```

Adicionar a `packages/contracts/src/index.ts`:

```ts
export * from './planejamento';
```

`apps/api/src/common/list-filters.dto.ts`:

```ts
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class ListFiltersDto {
  @IsOptional()
  @IsString()
  safraId?: string;

  @IsOptional()
  @IsString()
  talhaoId?: string;

  @IsOptional()
  @IsISO8601()
  de?: string;

  @IsOptional()
  @IsISO8601()
  ate?: string;
}
```

`apps/api/test/support/fixtures.ts`:

```ts
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

export async function criarFixturesAgricolas(app: INestApplication) {
  const propriedade = await request(app.getHttpServer())
    .post('/propriedades')
    .send({ nome: 'Fazenda Esperança', areaHa: 10000 })
    .expect(201);

  const talhao = await request(app.getHttpServer())
    .post(`/propriedades/${propriedade.body.id}/talhoes`)
    .send({ nome: 'Talhão 1', areaHa: 2000 })
    .expect(201);

  const safra = await request(app.getHttpServer())
    .post('/safras')
    .send({
      nome: 'Colheitas 25/26 Soja',
      cultura: 'Soja',
      dataInicio: '2025-06-01T00:00:00.000Z',
      dataFim: '2026-06-01T00:00:00.000Z',
    })
    .expect(201);

  const procedimento = await request(app.getHttpServer())
    .post('/procedimentos')
    .send({ nome: '1ª Aplicação de Fungicida', tipo: 'APLICACAO' })
    .expect(201);

  const procedimentoColheita = await request(app.getHttpServer())
    .post('/procedimentos')
    .send({ nome: 'Colheita', tipo: 'COLHEITA' })
    .expect(201);

  const insumo = await request(app.getHttpServer())
    .post('/insumos')
    .send({ nome: 'Fox Supra', unidade: 'litro', precoUnitarioAtual: 100 })
    .expect(201);

  return {
    talhao: talhao.body,
    safra: safra.body,
    procedimento: procedimento.body,
    procedimentoColheita: procedimentoColheita.body,
    insumo: insumo.body,
  };
}
```

`apps/api/test/planejamentos.test.ts`:

```ts
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { criarFixturesAgricolas } from './support/fixtures';

describe('Planejamentos', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.organizacao.deleteMany();
  });

  it('creates a planejamento and computes custoEstimado from insumo dose and talhao area', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app);
    const futura = new Date(Date.now() + 86400000).toISOString();

    const response = await request(app.getHttpServer())
      .post('/planejamentos')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: futura,
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.35 }],
      })
      .expect(201);

    // custoEstimado = 0.35 l/ha * 2000 ha * R$100/l = R$70.000,00
    expect(response.body.custoEstimado).toBe('70000.00');
    expect(response.body.status).toBe('PLANEJADO');
    expect(response.body.insumos).toHaveLength(1);
  });

  it('marks a planejamento as ATRASADO when dataPrevista has passed without execução', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app);
    const passada = new Date(Date.now() - 86400000).toISOString();

    const response = await request(app.getHttpServer())
      .post('/planejamentos')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: passada,
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.1 }],
      })
      .expect(201);

    const got = await request(app.getHttpServer())
      .get(`/planejamentos/${response.body.id}`)
      .expect(200);
    expect(got.body.status).toBe('ATRASADO');
  });

  it('rejects planejamento referencing an unknown talhao', async () => {
    const { safra, procedimento, insumo } = await criarFixturesAgricolas(app);
    await request(app.getHttpServer())
      .post('/planejamentos')
      .send({
        safraId: safra.id,
        talhaoId: 'nao-existe',
        procedimentoId: procedimento.id,
        dataPrevista: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.1 }],
      })
      .expect(404);
  });

  it('rejects dataPrevista outside the safra period', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app);
    // safra de fixtures vai de 2025-06-01 a 2026-06-01
    await request(app.getHttpServer())
      .post('/planejamentos')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: '2027-01-01T00:00:00.000Z',
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.1 }],
      })
      .expect(400);
  });

  it('filters planejamentos by safraId and talhaoId', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app);
    await request(app.getHttpServer())
      .post('/planejamentos')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.1 }],
      })
      .expect(201);

    const found = await request(app.getHttpServer())
      .get(`/planejamentos?safraId=${safra.id}&talhaoId=${talhao.id}`)
      .expect(200);
    expect(found.body).toHaveLength(1);

    const notFound = await request(app.getHttpServer())
      .get(`/planejamentos?safraId=${safra.id}&talhaoId=outro-talhao`)
      .expect(200);
    expect(notFound.body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @agro/api test -- planejamentos.test`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Implementar**

`apps/api/src/planejamentos/planejamentos.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PlanejamentoInsumoDto {
  @IsString()
  @IsNotEmpty()
  insumoId!: string;

  @IsNumber()
  @IsPositive()
  dosePorHa!: number;
}

export class CreatePlanejamentoDto {
  @IsString()
  @IsNotEmpty()
  safraId!: string;

  @IsString()
  @IsNotEmpty()
  talhaoId!: string;

  @IsString()
  @IsNotEmpty()
  procedimentoId!: string;

  @IsISO8601()
  dataPrevista!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanejamentoInsumoDto)
  insumos!: PlanejamentoInsumoDto[];
}
```

`apps/api/src/planejamentos/planejamentos.service.ts`:

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PlanejamentoResponse, PlanejamentoStatus } from '@agro/contracts';
import { Prisma } from '../../generated/prisma/client';
import { ListFiltersDto } from '../common/list-filters.dto';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePlanejamentoDto } from './planejamentos.dto';

type PlanejamentoRow = {
  id: string;
  safraId: string;
  talhaoId: string;
  procedimentoId: string;
  dataPrevista: Date;
  custoEstimado: Prisma.Decimal;
  observacao: string | null;
  createdAt: Date;
  insumos: {
    insumoId: string;
    dosePorHa: Prisma.Decimal;
    precoUnitarioSnapshot: Prisma.Decimal;
  }[];
  execucoes: { id: string }[];
};

const PLANEJAMENTO_INCLUDE = {
  insumos: true,
  execucoes: { select: { id: true } },
};

@Injectable()
export class PlanejamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private computeStatus(item: PlanejamentoRow): PlanejamentoStatus {
    if (item.execucoes.length > 0) return 'EXECUTADO';
    return item.dataPrevista.getTime() < Date.now() ? 'ATRASADO' : 'PLANEJADO';
  }

  private toResponse(item: PlanejamentoRow): PlanejamentoResponse {
    return {
      id: item.id,
      safraId: item.safraId,
      talhaoId: item.talhaoId,
      procedimentoId: item.procedimentoId,
      dataPrevista: item.dataPrevista.toISOString(),
      custoEstimado: item.custoEstimado.toString(),
      observacao: item.observacao,
      status: this.computeStatus(item),
      insumos: item.insumos.map((i) => ({
        insumoId: i.insumoId,
        dosePorHa: i.dosePorHa.toString(),
        precoUnitarioSnapshot: i.precoUnitarioSnapshot.toString(),
      })),
      createdAt: item.createdAt.toISOString(),
    };
  }

  async list(filters: ListFiltersDto): Promise<PlanejamentoResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const items = await this.prisma.planejamentoItem.findMany({
      where: {
        organizacaoId,
        safraId: filters.safraId,
        talhaoId: filters.talhaoId,
        dataPrevista: {
          gte: filters.de ? new Date(filters.de) : undefined,
          lte: filters.ate ? new Date(filters.ate) : undefined,
        },
      },
      include: PLANEJAMENTO_INCLUDE,
      orderBy: { dataPrevista: 'asc' },
    });
    return items.map((item) => this.toResponse(item));
  }

  async create(dto: CreatePlanejamentoDto): Promise<PlanejamentoResponse> {
    const organizacaoId = await this.currentOrg.getId();

    const [safra, talhao, procedimento] = await Promise.all([
      this.prisma.safra.findUnique({ where: { id: dto.safraId } }),
      this.prisma.talhao.findUnique({ where: { id: dto.talhaoId } }),
      this.prisma.procedimento.findUnique({
        where: { id: dto.procedimentoId },
      }),
    ]);
    if (!safra) throw new NotFoundException('Safra não encontrada');
    if (!talhao) throw new NotFoundException('Talhão não encontrado');
    if (!procedimento)
      throw new NotFoundException('Procedimento não encontrado');

    const dataPrevista = new Date(dto.dataPrevista);
    if (dataPrevista < safra.dataInicio || dataPrevista > safra.dataFim) {
      throw new BadRequestException('dataPrevista fora do período da safra');
    }

    const insumoIds = dto.insumos.map((i) => i.insumoId);
    const insumos = await this.prisma.insumo.findMany({
      where: { id: { in: insumoIds } },
    });
    if (insumos.length !== insumoIds.length) {
      throw new NotFoundException('Um ou mais insumos não foram encontrados');
    }
    const insumoById = new Map(insumos.map((i) => [i.id, i]));

    const areaHa = talhao.areaHa.toNumber();
    let custoEstimado = 0;
    const insumoRows = dto.insumos.map((item) => {
      const insumo = insumoById.get(item.insumoId);
      if (!insumo) throw new NotFoundException('Insumo não encontrado');
      custoEstimado +=
        item.dosePorHa * areaHa * insumo.precoUnitarioAtual.toNumber();
      return {
        insumoId: item.insumoId,
        dosePorHa: new Prisma.Decimal(item.dosePorHa),
        precoUnitarioSnapshot: insumo.precoUnitarioAtual,
      };
    });

    const planejamento = await this.prisma.planejamentoItem.create({
      data: {
        organizacaoId,
        safraId: dto.safraId,
        talhaoId: dto.talhaoId,
        procedimentoId: dto.procedimentoId,
        dataPrevista,
        custoEstimado: new Prisma.Decimal(custoEstimado.toFixed(2)),
        observacao: dto.observacao ?? null,
        insumos: { create: insumoRows },
      },
      include: PLANEJAMENTO_INCLUDE,
    });

    return this.toResponse(planejamento);
  }

  async getOrThrow(id: string): Promise<PlanejamentoRow> {
    const item = await this.prisma.planejamentoItem.findUnique({
      where: { id },
      include: PLANEJAMENTO_INCLUDE,
    });
    if (!item) throw new NotFoundException('Planejamento não encontrado');
    return item;
  }

  async getById(id: string): Promise<PlanejamentoResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }
}
```

`apps/api/src/planejamentos/planejamentos.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListFiltersDto } from '../common/list-filters.dto';
import { CreatePlanejamentoDto } from './planejamentos.dto';
import { PlanejamentosService } from './planejamentos.service';

@ApiTags('planejamentos')
@Controller('planejamentos')
export class PlanejamentosController {
  constructor(private readonly service: PlanejamentosService) {}

  @Get()
  list(@Query() filters: ListFiltersDto) {
    return this.service.list(filters);
  }

  @Post()
  create(@Body() dto: CreatePlanejamentoDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
```

`apps/api/src/planejamentos/planejamentos.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { PlanejamentosController } from './planejamentos.controller';
import { PlanejamentosService } from './planejamentos.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [PlanejamentosController],
  providers: [PlanejamentosService],
  exports: [PlanejamentosService],
})
export class PlanejamentosModule {}
```

Editar `apps/api/src/app.module.ts` — adicionar `PlanejamentosModule` ao array `imports`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @agro/api test`
Expected: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/planejamento.ts packages/contracts/src/index.ts apps/api/src/common apps/api/src/planejamentos apps/api/src/app.module.ts apps/api/test/support apps/api/test/planejamentos.test.ts
git commit -m "feat(api): adiciona recurso Planejamento com custo estimado e status calculado"
```

---

## Task 10: Execução (ExecucaoItem + ExecucaoInsumo + vínculo opcional ao Planejamento)

**Files:**

- Create: `packages/contracts/src/execucao.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/execucoes/execucoes.dto.ts`
- Create: `apps/api/src/execucoes/execucoes.service.ts`
- Create: `apps/api/src/execucoes/execucoes.controller.ts`
- Create: `apps/api/src/execucoes/execucoes.module.ts`
- Create: `apps/api/test/execucoes.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `PrismaService`, `CurrentOrganizationService`, `ListFiltersDto` (Task 9), `criarFixturesAgricolas` (Task 9).
- Produces: `ExecucaoResponse` (`@agro/contracts`).

- [ ] **Step 1: Escrever o contrato e o teste**

`packages/contracts/src/execucao.ts`:

```ts
import { z } from 'zod';

export const execucaoInsumoResponseSchema = z
  .object({
    insumoId: z.string(),
    quantidade: z.string(),
    precoUnitarioSnapshot: z.string(),
  })
  .strict();

export const execucaoResponseSchema = z
  .object({
    id: z.string(),
    safraId: z.string(),
    talhaoId: z.string(),
    procedimentoId: z.string(),
    planejamentoItemId: z.string().nullable(),
    data: z.iso.datetime(),
    custoTotal: z.string(),
    operador: z.string().nullable(),
    maquina: z.string().nullable(),
    quantidadeColhidaSacas: z.string().nullable(),
    observacao: z.string().nullable(),
    insumos: z.array(execucaoInsumoResponseSchema),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type ExecucaoResponse = z.infer<typeof execucaoResponseSchema>;
```

Adicionar a `packages/contracts/src/index.ts`:

```ts
export * from './execucao';
```

`apps/api/test/execucoes.test.ts`:

```ts
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { criarFixturesAgricolas } from './support/fixtures';

describe('Execuções', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.organizacao.deleteMany();
  });

  it('creates an execução linked to a planejamento, computes custoTotal, and flips the planejamento status', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app);
    const futura = new Date(Date.now() + 86400000).toISOString();

    const planejamento = await request(app.getHttpServer())
      .post('/planejamentos')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: futura,
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.35 }],
      })
      .expect(201);

    const execucao = await request(app.getHttpServer())
      .post('/execucoes')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        planejamentoItemId: planejamento.body.id,
        data: new Date().toISOString(),
        operador: 'José Dias Nunes',
        maquina: 'Drone Pulverizador DJI Agras T50',
        insumos: [{ insumoId: insumo.id, quantidade: 700 }],
      })
      .expect(201);

    // custoTotal = 700 l * R$100/l = R$70.000,00
    expect(execucao.body.custoTotal).toBe('70000.00');
    expect(execucao.body.planejamentoItemId).toBe(planejamento.body.id);

    const planejamentoAtualizado = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.body.id}`)
      .expect(200);
    expect(planejamentoAtualizado.body.status).toBe('EXECUTADO');
  });

  it('accepts quantidadeColhidaSacas only for procedimentos do tipo COLHEITA', async () => {
    const { talhao, safra, procedimento, procedimentoColheita, insumo } =
      await criarFixturesAgricolas(app);

    await request(app.getHttpServer())
      .post('/execucoes')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        data: new Date().toISOString(),
        quantidadeColhidaSacas: 500,
        insumos: [{ insumoId: insumo.id, quantidade: 10 }],
      })
      .expect(400);

    const colheita = await request(app.getHttpServer())
      .post('/execucoes')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimentoColheita.id,
        data: new Date().toISOString(),
        quantidadeColhidaSacas: 500,
        insumos: [{ insumoId: insumo.id, quantidade: 10 }],
      })
      .expect(201);
    expect(colheita.body.quantidadeColhidaSacas).toBe('500.00');
  });

  it('rejects execução whose safra/talhao/procedimento diverge from the linked planejamento', async () => {
    const { talhao, safra, procedimento, procedimentoColheita, insumo } =
      await criarFixturesAgricolas(app);
    const futura = new Date(Date.now() + 86400000).toISOString();

    const planejamento = await request(app.getHttpServer())
      .post('/planejamentos')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: futura,
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.1 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/execucoes')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimentoColheita.id,
        planejamentoItemId: planejamento.body.id,
        data: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, quantidade: 1 }],
      })
      .expect(400);
  });

  it('rejects data outside the safra period', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app);
    // safra de fixtures vai de 2025-06-01 a 2026-06-01
    await request(app.getHttpServer())
      .post('/execucoes')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        data: '2027-01-01T00:00:00.000Z',
        insumos: [{ insumoId: insumo.id, quantidade: 1 }],
      })
      .expect(400);
  });

  it('creates a standalone execução without a planejamento', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app);

    const execucao = await request(app.getHttpServer())
      .post('/execucoes')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        data: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, quantidade: 10 }],
      })
      .expect(201);
    expect(execucao.body.planejamentoItemId).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @agro/api test -- execucoes.test`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Implementar**

`apps/api/src/execucoes/execucoes.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ExecucaoInsumoDto {
  @IsString()
  @IsNotEmpty()
  insumoId!: string;

  @IsNumber()
  @IsPositive()
  quantidade!: number;
}

export class CreateExecucaoDto {
  @IsString()
  @IsNotEmpty()
  safraId!: string;

  @IsString()
  @IsNotEmpty()
  talhaoId!: string;

  @IsString()
  @IsNotEmpty()
  procedimentoId!: string;

  @IsOptional()
  @IsString()
  planejamentoItemId?: string;

  @IsISO8601()
  data!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  operador?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  maquina?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantidadeColhidaSacas?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecucaoInsumoDto)
  insumos!: ExecucaoInsumoDto[];
}
```

`apps/api/src/execucoes/execucoes.service.ts`:

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ExecucaoResponse } from '@agro/contracts';
import { Prisma } from '../../generated/prisma/client';
import { ListFiltersDto } from '../common/list-filters.dto';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateExecucaoDto } from './execucoes.dto';

type ExecucaoRow = {
  id: string;
  safraId: string;
  talhaoId: string;
  procedimentoId: string;
  planejamentoItemId: string | null;
  data: Date;
  custoTotal: Prisma.Decimal;
  operador: string | null;
  maquina: string | null;
  quantidadeColhidaSacas: Prisma.Decimal | null;
  observacao: string | null;
  createdAt: Date;
  insumos: {
    insumoId: string;
    quantidade: Prisma.Decimal;
    precoUnitarioSnapshot: Prisma.Decimal;
  }[];
};

const EXECUCAO_INCLUDE = { insumos: true };

@Injectable()
export class ExecucoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(item: ExecucaoRow): ExecucaoResponse {
    return {
      id: item.id,
      safraId: item.safraId,
      talhaoId: item.talhaoId,
      procedimentoId: item.procedimentoId,
      planejamentoItemId: item.planejamentoItemId,
      data: item.data.toISOString(),
      custoTotal: item.custoTotal.toString(),
      operador: item.operador,
      maquina: item.maquina,
      quantidadeColhidaSacas: item.quantidadeColhidaSacas?.toString() ?? null,
      observacao: item.observacao,
      insumos: item.insumos.map((i) => ({
        insumoId: i.insumoId,
        quantidade: i.quantidade.toString(),
        precoUnitarioSnapshot: i.precoUnitarioSnapshot.toString(),
      })),
      createdAt: item.createdAt.toISOString(),
    };
  }

  async list(filters: ListFiltersDto): Promise<ExecucaoResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const items = await this.prisma.execucaoItem.findMany({
      where: {
        organizacaoId,
        safraId: filters.safraId,
        talhaoId: filters.talhaoId,
        data: {
          gte: filters.de ? new Date(filters.de) : undefined,
          lte: filters.ate ? new Date(filters.ate) : undefined,
        },
      },
      include: EXECUCAO_INCLUDE,
      orderBy: { data: 'asc' },
    });
    return items.map((item) => this.toResponse(item));
  }

  async create(dto: CreateExecucaoDto): Promise<ExecucaoResponse> {
    const organizacaoId = await this.currentOrg.getId();

    const [safra, talhao, procedimento] = await Promise.all([
      this.prisma.safra.findUnique({ where: { id: dto.safraId } }),
      this.prisma.talhao.findUnique({ where: { id: dto.talhaoId } }),
      this.prisma.procedimento.findUnique({
        where: { id: dto.procedimentoId },
      }),
    ]);
    if (!safra) throw new NotFoundException('Safra não encontrada');
    if (!talhao) throw new NotFoundException('Talhão não encontrado');
    if (!procedimento)
      throw new NotFoundException('Procedimento não encontrado');

    const data = new Date(dto.data);
    if (data < safra.dataInicio || data > safra.dataFim) {
      throw new BadRequestException('data fora do período da safra');
    }

    if (
      dto.quantidadeColhidaSacas !== undefined &&
      procedimento.tipo !== 'COLHEITA'
    ) {
      throw new BadRequestException(
        'quantidadeColhidaSacas só é permitido para procedimentos do tipo COLHEITA',
      );
    }

    if (dto.planejamentoItemId) {
      const planejamentoItem = await this.prisma.planejamentoItem.findUnique({
        where: { id: dto.planejamentoItemId },
      });
      if (!planejamentoItem)
        throw new NotFoundException('Planejamento não encontrado');
      if (
        planejamentoItem.safraId !== dto.safraId ||
        planejamentoItem.talhaoId !== dto.talhaoId ||
        planejamentoItem.procedimentoId !== dto.procedimentoId
      ) {
        throw new BadRequestException(
          'A execução deve usar a mesma Safra, Talhão e Procedimento do planejamento vinculado',
        );
      }
    }

    const insumoIds = dto.insumos.map((i) => i.insumoId);
    const insumos = await this.prisma.insumo.findMany({
      where: { id: { in: insumoIds } },
    });
    if (insumos.length !== insumoIds.length) {
      throw new NotFoundException('Um ou mais insumos não foram encontrados');
    }
    const insumoById = new Map(insumos.map((i) => [i.id, i]));

    let custoTotal = 0;
    const insumoRows = dto.insumos.map((item) => {
      const insumo = insumoById.get(item.insumoId);
      if (!insumo) throw new NotFoundException('Insumo não encontrado');
      custoTotal += item.quantidade * insumo.precoUnitarioAtual.toNumber();
      return {
        insumoId: item.insumoId,
        quantidade: new Prisma.Decimal(item.quantidade),
        precoUnitarioSnapshot: insumo.precoUnitarioAtual,
      };
    });

    const execucao = await this.prisma.execucaoItem.create({
      data: {
        organizacaoId,
        safraId: dto.safraId,
        talhaoId: dto.talhaoId,
        procedimentoId: dto.procedimentoId,
        planejamentoItemId: dto.planejamentoItemId ?? null,
        data,
        custoTotal: new Prisma.Decimal(custoTotal.toFixed(2)),
        operador: dto.operador ?? null,
        maquina: dto.maquina ?? null,
        quantidadeColhidaSacas:
          dto.quantidadeColhidaSacas !== undefined
            ? new Prisma.Decimal(dto.quantidadeColhidaSacas.toFixed(2))
            : null,
        observacao: dto.observacao ?? null,
        insumos: { create: insumoRows },
      },
      include: EXECUCAO_INCLUDE,
    });

    return this.toResponse(execucao);
  }
}
```

`apps/api/src/execucoes/execucoes.controller.ts`:

```ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListFiltersDto } from '../common/list-filters.dto';
import { CreateExecucaoDto } from './execucoes.dto';
import { ExecucoesService } from './execucoes.service';

@ApiTags('execucoes')
@Controller('execucoes')
export class ExecucoesController {
  constructor(private readonly service: ExecucoesService) {}

  @Get()
  list(@Query() filters: ListFiltersDto) {
    return this.service.list(filters);
  }

  @Post()
  create(@Body() dto: CreateExecucaoDto) {
    return this.service.create(dto);
  }
}
```

`apps/api/src/execucoes/execucoes.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { ExecucoesController } from './execucoes.controller';
import { ExecucoesService } from './execucoes.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [ExecucoesController],
  providers: [ExecucoesService],
  exports: [ExecucoesService],
})
export class ExecucoesModule {}
```

Editar `apps/api/src/app.module.ts` — adicionar `ExecucoesModule` ao array `imports`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @agro/api test`
Expected: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/execucao.ts packages/contracts/src/index.ts apps/api/src/execucoes apps/api/src/app.module.ts apps/api/test/execucoes.test.ts
git commit -m "feat(api): adiciona recurso Execução com vínculo opcional ao Planejamento"
```

---

## Task 11: Compra de Insumo

**Files:**

- Create: `packages/contracts/src/compra-insumo.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/compras-insumo/compras-insumo.dto.ts`
- Create: `apps/api/src/compras-insumo/compras-insumo.service.ts`
- Create: `apps/api/src/compras-insumo/compras-insumo.controller.ts`
- Create: `apps/api/src/compras-insumo/compras-insumo.module.ts`
- Create: `apps/api/test/compras-insumo.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: `PrismaService`, `CurrentOrganizationService`, `ListFiltersDto`, `criarFixturesAgricolas` (Task 9).
- Produces: `CompraInsumoResponse` (`@agro/contracts`).

- [ ] **Step 1: Escrever o contrato e o teste**

`packages/contracts/src/compra-insumo.ts`:

```ts
import { z } from 'zod';

export const compraInsumoResponseSchema = z
  .object({
    id: z.string(),
    talhaoId: z.string(),
    safraId: z.string(),
    insumoId: z.string(),
    data: z.iso.datetime(),
    quantidade: z.string(),
    precoUnitarioSnapshot: z.string(),
    custoTotal: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type CompraInsumoResponse = z.infer<typeof compraInsumoResponseSchema>;
```

Adicionar a `packages/contracts/src/index.ts`:

```ts
export * from './compra-insumo';
```

`apps/api/test/compras-insumo.test.ts`:

```ts
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { criarFixturesAgricolas } from './support/fixtures';

describe('Compras de Insumo', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.organizacao.deleteMany();
  });

  it('creates a compra de insumo and computes custoTotal from the current price', async () => {
    const { talhao, safra, insumo } = await criarFixturesAgricolas(app);

    const compra = await request(app.getHttpServer())
      .post('/compras-insumo')
      .send({
        talhaoId: talhao.id,
        safraId: safra.id,
        insumoId: insumo.id,
        data: new Date().toISOString(),
        quantidade: 91,
      })
      .expect(201);

    // custoTotal = 91 l * R$100/l = R$9.100,00
    expect(compra.body.custoTotal).toBe('9100.00');
    expect(compra.body.precoUnitarioSnapshot).toBe('100.0000');

    const list = await request(app.getHttpServer())
      .get(`/compras-insumo?talhaoId=${talhao.id}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects compra referencing an unknown insumo', async () => {
    const { talhao, safra } = await criarFixturesAgricolas(app);
    await request(app.getHttpServer())
      .post('/compras-insumo')
      .send({
        talhaoId: talhao.id,
        safraId: safra.id,
        insumoId: 'nao-existe',
        data: new Date().toISOString(),
        quantidade: 1,
      })
      .expect(404);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @agro/api test -- compras-insumo.test`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Implementar**

`apps/api/src/compras-insumo/compras-insumo.dto.ts`:

```ts
import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateCompraInsumoDto {
  @IsString()
  @IsNotEmpty()
  talhaoId!: string;

  @IsString()
  @IsNotEmpty()
  safraId!: string;

  @IsString()
  @IsNotEmpty()
  insumoId!: string;

  @IsISO8601()
  data!: string;

  @IsNumber()
  @IsPositive()
  quantidade!: number;
}
```

`apps/api/src/compras-insumo/compras-insumo.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import type { CompraInsumoResponse } from '@agro/contracts';
import { Prisma } from '../../generated/prisma/client';
import { ListFiltersDto } from '../common/list-filters.dto';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCompraInsumoDto } from './compras-insumo.dto';

type CompraInsumoRow = {
  id: string;
  talhaoId: string;
  safraId: string;
  insumoId: string;
  data: Date;
  quantidade: Prisma.Decimal;
  precoUnitarioSnapshot: Prisma.Decimal;
  custoTotal: Prisma.Decimal;
  createdAt: Date;
};

@Injectable()
export class ComprasInsumoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(compra: CompraInsumoRow): CompraInsumoResponse {
    return {
      id: compra.id,
      talhaoId: compra.talhaoId,
      safraId: compra.safraId,
      insumoId: compra.insumoId,
      data: compra.data.toISOString(),
      quantidade: compra.quantidade.toString(),
      precoUnitarioSnapshot: compra.precoUnitarioSnapshot.toString(),
      custoTotal: compra.custoTotal.toString(),
      createdAt: compra.createdAt.toISOString(),
    };
  }

  async list(filters: ListFiltersDto): Promise<CompraInsumoResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const compras = await this.prisma.compraInsumo.findMany({
      where: {
        organizacaoId,
        safraId: filters.safraId,
        talhaoId: filters.talhaoId,
        data: {
          gte: filters.de ? new Date(filters.de) : undefined,
          lte: filters.ate ? new Date(filters.ate) : undefined,
        },
      },
      orderBy: { data: 'asc' },
    });
    return compras.map((c) => this.toResponse(c));
  }

  async create(dto: CreateCompraInsumoDto): Promise<CompraInsumoResponse> {
    const organizacaoId = await this.currentOrg.getId();

    const [talhao, safra, insumo] = await Promise.all([
      this.prisma.talhao.findUnique({ where: { id: dto.talhaoId } }),
      this.prisma.safra.findUnique({ where: { id: dto.safraId } }),
      this.prisma.insumo.findUnique({ where: { id: dto.insumoId } }),
    ]);
    if (!talhao) throw new NotFoundException('Talhão não encontrado');
    if (!safra) throw new NotFoundException('Safra não encontrada');
    if (!insumo) throw new NotFoundException('Insumo não encontrado');

    const custoTotal = dto.quantidade * insumo.precoUnitarioAtual.toNumber();

    const compra = await this.prisma.compraInsumo.create({
      data: {
        organizacaoId,
        talhaoId: dto.talhaoId,
        safraId: dto.safraId,
        insumoId: dto.insumoId,
        data: new Date(dto.data),
        quantidade: new Prisma.Decimal(dto.quantidade),
        precoUnitarioSnapshot: insumo.precoUnitarioAtual,
        custoTotal: new Prisma.Decimal(custoTotal.toFixed(2)),
      },
    });

    return this.toResponse(compra);
  }
}
```

`apps/api/src/compras-insumo/compras-insumo.controller.ts`:

```ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListFiltersDto } from '../common/list-filters.dto';
import { ComprasInsumoService } from './compras-insumo.service';
import { CreateCompraInsumoDto } from './compras-insumo.dto';

@ApiTags('compras-insumo')
@Controller('compras-insumo')
export class ComprasInsumoController {
  constructor(private readonly service: ComprasInsumoService) {}

  @Get()
  list(@Query() filters: ListFiltersDto) {
    return this.service.list(filters);
  }

  @Post()
  create(@Body() dto: CreateCompraInsumoDto) {
    return this.service.create(dto);
  }
}
```

`apps/api/src/compras-insumo/compras-insumo.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { ComprasInsumoController } from './compras-insumo.controller';
import { ComprasInsumoService } from './compras-insumo.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [ComprasInsumoController],
  providers: [ComprasInsumoService],
  exports: [ComprasInsumoService],
})
export class ComprasInsumoModule {}
```

Editar `apps/api/src/app.module.ts` — adicionar `ComprasInsumoModule` ao array `imports`. Este é o último módulo; o arquivo final deve conter todos os módulos das Tasks 2 a 11 no array `imports`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @agro/api test`
Expected: PASS em todos os arquivos.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/compra-insumo.ts packages/contracts/src/index.ts apps/api/src/compras-insumo apps/api/src/app.module.ts apps/api/test/compras-insumo.test.ts
git commit -m "feat(api): adiciona recurso Compra de Insumo"
```

---

## Task 12: Validação final do monorepo

**Files:** nenhum arquivo novo — só correções pontuais se alguma validação falhar.

**Interfaces:**

- Consumes: tudo das Tasks 1-11.
- Produces: nada novo — é o gate final antes de considerar a feature pronta.

- [ ] **Step 1: Rodar lint**

Run: `pnpm lint`
Expected: sem erros. Se o ESLint reclamar de imports não usados ou ordenação, corrigir e re-rodar.

- [ ] **Step 2: Rodar typecheck**

Run: `pnpm typecheck`
Expected: sem erros em nenhum pacote/app.

- [ ] **Step 3: Rodar a suíte de testes completa**

Run: `pnpm test`
Expected: todos os arquivos de teste (incluindo `health.test.ts` atualizado e os 9 novos) passam.

- [ ] **Step 4: Rodar o build**

Run: `pnpm build`
Expected: `@agro/contracts`, `@agro/validation`, `@agro/api` e `@agro/web` buildam sem erros (o `@agro/web` não muda nesta fase, mas precisa continuar buildando).

- [ ] **Step 5: Commit final (se Steps 1-4 exigiram correções)**

```bash
git add -A
git commit -m "chore(api): corrige lint/typecheck apontados pela validação final do domínio de Gestão Agrícola"
```

Se nenhuma correção foi necessária, não há o que commitar neste passo — a feature já está completa ao final da Task 11.
