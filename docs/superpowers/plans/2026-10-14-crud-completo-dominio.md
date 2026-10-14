# CRUD Completo do Domínio Agrícola Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a superfície REST das 8 entidades do domínio agrícola — DELETE nas entidades de catálogo (e, condicionalmente, em Planejamento não executado), GET por id onde falta, PATCH completo em Procedimento.

**Architecture:** Cada rota nova segue exatamente os padrões já estabelecidos no projeto: lookup escopado por organização (`findFirst` com `organizacaoId`, ou a forma especial via relação pra Talhão), DELETE usando a trava `ON DELETE RESTRICT` já existente no banco (traduzida de `P2003` pra 400 por um helper compartilhado novo), sem migration nova. Os testes de isolamento entre organizações (404 cross-org) para cada rota nova entram em `apps/api/test/isolamento-organizacoes.test.ts`, que já tem o par de organizações (`cookieOrgA`/`cookieOrgB`) pronto — em vez de duplicar esse setup em cada um dos 8 arquivos de teste por entidade.

**Tech Stack:** NestJS 11, Prisma 6.19.3, PostgreSQL 17 — mesmo stack de todo o resto do backend.

**Spec:** `docs/superpowers/specs/2026-10-14-crud-completo-dominio-design.md`

## Global Constraints

- Conventional Commits; hooks de lint-staged/commitlint ativos, não usar `--no-verify`.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter @agro/api test`, `pnpm build` precisam passar antes de considerar uma task terminada.
- Sem migration nova — a trava RESTRICT já existe desde `20261014090000_restrict_catalogo_para_transacional`.
- Toda rota nova é escopada pela organização do chamador via `CurrentOrganizationService.getId()` — nunca `findUnique({ where: { id } })` isolado. Talhão não tem `organizacaoId` próprio: usa `propriedade: { organizacaoId }`.
- DELETE sempre responde `204` sem corpo (`@HttpCode(204)`, mesmo padrão de `POST /auth/logout`).
- DELETE aberto a qualquer usuário autenticado da organização — sem checagem de papel.
- Execução e Compra de Insumo nunca ganham PATCH/DELETE (histórico financeiro imutável) — só GET por id.
- Testes de "com vínculo"/"sem vínculo" (single-org) vão no arquivo de teste da própria entidade, seguindo o padrão já existente nele (`beforeEach` com `limparBanco`+`autenticarComoOrgAdmin`, `cookie` disponível, `criarFixturesAgricolas(app, cookie)` de `apps/api/test/support/fixtures.ts`). Testes de "outra organização → 404" vão em `apps/api/test/isolamento-organizacoes.test.ts`, reaproveitando `cookieOrgA`/`cookieOrgB` que esse arquivo já monta.

---

### Task 1: Helper de exclusão + DELETE em Propriedade

**Files:**

- Create: `apps/api/src/common/excluir-com-restricao.ts`
- Modify: `apps/api/src/propriedades/propriedades.service.ts`
- Modify: `apps/api/src/propriedades/propriedades.controller.ts`
- Test: `apps/api/test/propriedades.test.ts`
- Test: `apps/api/test/isolamento-organizacoes.test.ts`

**Interfaces:**

- Produces: `excluirComRestricao(deleteFn: () => Promise<unknown>): Promise<void>` — lança `BadRequestException` se o Prisma reportar `P2003` (violação de FK), repassa qualquer outro erro. Usado pelas Tasks 2-5.

**Nota importante sobre o teste "com vínculo" de Propriedade:** a FK de `Propriedade` para `Talhao` é `Cascade` (estrutural, não é o caso "catálogo→transacional" do backlog #6) — apagar uma Propriedade cascateia pra seus Talhões automaticamente. Mas se um desses Talhões tiver histórico vinculado (um Planejamento, por exemplo), a cascata de Propriedade→Talhão esbarra na trava RESTRICT de Talhão→PlanejamentoItem, e o Postgres recusa a operação inteira (ele resolve toda a árvore de cascata dentro da mesma instrução antes de aplicar) — o erro ainda chega como `P2003`, então `excluirComRestricao` funciona igual. O teste "com vínculo" precisa de um Talhão **com** Planejamento pra isso acontecer; o teste "sem vínculo" usa uma Propriedade com um Talhão vazio (cascata simples, sem trava).

- [ ] **Step 1: Criar o helper**

Crie `apps/api/src/common/excluir-com-restricao.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

const MENSAGEM_PADRAO =
  'Não é possível excluir — já existe histórico vinculado a este registro.';

/**
 * Executa um delete do Prisma e traduz a violação de FK (ON DELETE
 * RESTRICT, já existente desde docs/BACKLOG.md #6) em 400, em vez de
 * deixar o Postgres estourar sozinho (500). Qualquer outro erro é
 * repassado sem alteração.
 */
export async function excluirComRestricao(
  deleteFn: () => Promise<unknown>,
): Promise<void> {
  try {
    await deleteFn();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new BadRequestException(MENSAGEM_PADRAO);
    }
    throw error;
  }
}
```

- [ ] **Step 2: Escrever os testes single-org (falham primeiro)**

Em `apps/api/test/propriedades.test.ts`, adicione (o arquivo já tem `describe('Propriedades', ...)`, `beforeAll`/`beforeEach` com `limparBanco`+`autenticarComoOrgAdmin`, e `cookie` disponível no escopo — siga exatamente esse padrão já existente, só adicione os `it`s abaixo dentro do mesmo `describe`):

```typescript
it('rejects deleting a Propriedade whose Talhão has history', async () => {
  const { talhao, safra, procedimento, insumo } = await criarFixturesAgricolas(
    app,
    cookie,
  );
  const propriedadeId = talhao.propriedadeId;

  await request(app.getHttpServer())
    .post('/planejamentos')
    .set('Cookie', cookie)
    .send({
      safraId: safra.id,
      talhaoId: talhao.id,
      procedimentoId: procedimento.id,
      dataPrevista: new Date(Date.now() + 86400000).toISOString(),
      insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }],
    })
    .expect(201);

  await request(app.getHttpServer())
    .delete(`/propriedades/${propriedadeId}`)
    .set('Cookie', cookie)
    .expect(400);

  const lista = await request(app.getHttpServer())
    .get('/propriedades')
    .set('Cookie', cookie)
    .expect(200);
  expect(lista.body).toHaveLength(1);
});

it('deletes a Propriedade with no history', async () => {
  const { talhao } = await criarFixturesAgricolas(app, cookie);
  const propriedadeId = talhao.propriedadeId;

  await request(app.getHttpServer())
    .delete(`/propriedades/${propriedadeId}`)
    .set('Cookie', cookie)
    .expect(204);

  const lista = await request(app.getHttpServer())
    .get('/propriedades')
    .set('Cookie', cookie)
    .expect(200);
  expect(lista.body).toHaveLength(0);
});
```

Se `criarFixturesAgricolas`/`autenticarComoOrgAdmin` ainda não estiverem importados no topo de `propriedades.test.ts`, adicione:

```typescript
import { criarFixturesAgricolas } from './support/fixtures';
```

(`autenticarComoOrgAdmin` já deve estar lá, usado no `beforeEach` existente — confirme antes de duplicar o import.)

Em `apps/api/test/isolamento-organizacoes.test.ts`, adicione, dentro do `describe('Isolamento entre organizações', ...)` já existente (reaproveita `cookieOrgA`/`cookieOrgB` já montados no `beforeEach` do arquivo — não precisa de setup novo):

```typescript
it('returns 404 deleting a Propriedade from another organization', async () => {
  const { talhao } = await criarFixturesAgricolas(app, cookieOrgA);
  const propriedadeId = talhao.propriedadeId;

  await request(app.getHttpServer())
    .delete(`/propriedades/${propriedadeId}`)
    .set('Cookie', cookieOrgB)
    .expect(404);
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `cd apps/api && pnpm test -- propriedades.test.ts isolamento-organizacoes.test.ts`
Expected: os 3 testes novos falham (rota `DELETE /propriedades/:id` não existe ainda — 404 do Nest por rota não encontrada, não o 404 "não encontrado" esperado pela regra de negócio).

- [ ] **Step 4: Implementar o DELETE**

Em `apps/api/src/propriedades/propriedades.service.ts`, adicione o import e o método:

```typescript
import { excluirComRestricao } from '../common/excluir-com-restricao';
// ...
  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await excluirComRestricao(() =>
      this.prisma.propriedade.delete({ where: { id } }),
    );
  }
```

Em `apps/api/src/propriedades/propriedades.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
// ...
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `cd apps/api && pnpm test -- propriedades.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/excluir-com-restricao.ts apps/api/src/propriedades/propriedades.service.ts apps/api/src/propriedades/propriedades.controller.ts apps/api/test/propriedades.test.ts apps/api/test/isolamento-organizacoes.test.ts
git commit -m "feat(api): adiciona DELETE em Propriedade e helper de exclusão com RESTRICT"
```

---

### Task 2: DELETE em Talhão

**Files:**

- Modify: `apps/api/src/talhoes/talhoes.service.ts`
- Modify: `apps/api/src/talhoes/talhoes.controller.ts`
- Test: `apps/api/test/talhoes.test.ts`
- Test: `apps/api/test/isolamento-organizacoes.test.ts`

**Interfaces:**

- Consumes: `excluirComRestricao` (Task 1).

Diferente de Propriedade, a FK de Talhão pras entidades transacionais (PlanejamentoItem/ExecucaoItem/CompraInsumo) é RESTRICT direto — sem cascata no meio.

- [ ] **Step 1: Escrever os testes single-org (falham primeiro)**

Em `apps/api/test/talhoes.test.ts`, dentro do `describe` já existente (mesmo padrão de `beforeEach`/`cookie`/`criarFixturesAgricolas` de `propriedades.test.ts`):

```typescript
it('rejects deleting a Talhão with Planejamento history', async () => {
  const { talhao, safra, procedimento, insumo } = await criarFixturesAgricolas(
    app,
    cookie,
  );

  await request(app.getHttpServer())
    .post('/planejamentos')
    .set('Cookie', cookie)
    .send({
      safraId: safra.id,
      talhaoId: talhao.id,
      procedimentoId: procedimento.id,
      dataPrevista: new Date(Date.now() + 86400000).toISOString(),
      insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }],
    })
    .expect(201);

  await request(app.getHttpServer())
    .delete(`/talhoes/${talhao.id}`)
    .set('Cookie', cookie)
    .expect(400);
});

it('deletes a Talhão with no history', async () => {
  const { talhao } = await criarFixturesAgricolas(app, cookie);

  await request(app.getHttpServer())
    .delete(`/talhoes/${talhao.id}`)
    .set('Cookie', cookie)
    .expect(204);

  await request(app.getHttpServer())
    .get(`/talhoes/${talhao.id}`)
    .set('Cookie', cookie)
    .expect(404);
});
```

Em `apps/api/test/isolamento-organizacoes.test.ts`, adicione:

```typescript
it('returns 404 deleting a Talhão from another organization', async () => {
  const { talhao } = await criarFixturesAgricolas(app, cookieOrgA);

  await request(app.getHttpServer())
    .delete(`/talhoes/${talhao.id}`)
    .set('Cookie', cookieOrgB)
    .expect(404);
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd apps/api && pnpm test -- talhoes.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 3: Implementar**

Em `apps/api/src/talhoes/talhoes.service.ts`:

```typescript
import { excluirComRestricao } from '../common/excluir-com-restricao';
// ...
  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await excluirComRestricao(() =>
      this.prisma.talhao.delete({ where: { id } }),
    );
  }
```

Em `apps/api/src/talhoes/talhoes.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
// ...
  @Delete('talhoes/:id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `cd apps/api && pnpm test -- talhoes.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/talhoes/talhoes.service.ts apps/api/src/talhoes/talhoes.controller.ts apps/api/test/talhoes.test.ts apps/api/test/isolamento-organizacoes.test.ts
git commit -m "feat(api): adiciona DELETE em Talhão"
```

---

### Task 3: DELETE em Safra

**Files:**

- Modify: `apps/api/src/safras/safras.service.ts`
- Modify: `apps/api/src/safras/safras.controller.ts`
- Test: `apps/api/test/safras.test.ts`
- Test: `apps/api/test/isolamento-organizacoes.test.ts`

**Interfaces:**

- Consumes: `excluirComRestricao` (Task 1).

- [ ] **Step 1: Escrever os testes single-org (falham primeiro)**

Em `apps/api/test/safras.test.ts`:

```typescript
it('rejects deleting a Safra with Planejamento history', async () => {
  const { talhao, safra, procedimento, insumo } = await criarFixturesAgricolas(
    app,
    cookie,
  );

  await request(app.getHttpServer())
    .post('/planejamentos')
    .set('Cookie', cookie)
    .send({
      safraId: safra.id,
      talhaoId: talhao.id,
      procedimentoId: procedimento.id,
      dataPrevista: new Date(Date.now() + 86400000).toISOString(),
      insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }],
    })
    .expect(201);

  await request(app.getHttpServer())
    .delete(`/safras/${safra.id}`)
    .set('Cookie', cookie)
    .expect(400);
});

it('deletes a Safra with no history', async () => {
  const { safra } = await criarFixturesAgricolas(app, cookie);

  await request(app.getHttpServer())
    .delete(`/safras/${safra.id}`)
    .set('Cookie', cookie)
    .expect(204);

  await request(app.getHttpServer())
    .get(`/safras/${safra.id}`)
    .set('Cookie', cookie)
    .expect(404);
});
```

Em `apps/api/test/isolamento-organizacoes.test.ts`, adicione:

```typescript
it('returns 404 deleting a Safra from another organization', async () => {
  const { safra } = await criarFixturesAgricolas(app, cookieOrgA);

  await request(app.getHttpServer())
    .delete(`/safras/${safra.id}`)
    .set('Cookie', cookieOrgB)
    .expect(404);
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd apps/api && pnpm test -- safras.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 3: Implementar**

Em `apps/api/src/safras/safras.service.ts`:

```typescript
import { excluirComRestricao } from '../common/excluir-com-restricao';
// ...
  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await excluirComRestricao(() =>
      this.prisma.safra.delete({ where: { id } }),
    );
  }
```

Em `apps/api/src/safras/safras.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
// ...
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `cd apps/api && pnpm test -- safras.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/safras/safras.service.ts apps/api/src/safras/safras.controller.ts apps/api/test/safras.test.ts apps/api/test/isolamento-organizacoes.test.ts
git commit -m "feat(api): adiciona DELETE em Safra"
```

---

### Task 4: GET por id, PATCH e DELETE em Procedimento

**Files:**

- Modify: `apps/api/src/procedimentos/procedimentos.dto.ts`
- Modify: `apps/api/src/procedimentos/procedimentos.service.ts`
- Modify: `apps/api/src/procedimentos/procedimentos.controller.ts`
- Test: `apps/api/test/procedimentos.test.ts`
- Test: `apps/api/test/isolamento-organizacoes.test.ts`

**Interfaces:**

- Consumes: `excluirComRestricao` (Task 1).
- Produces: `UpdateProcedimentoDto`.

Procedimento hoje só tem `list`/`create`/`getOrThrow` (usado internamente por outras services, não exposto). Esta task expõe `getOrThrow` via rota, adiciona `update`, e adiciona `remove`.

- [ ] **Step 1: Escrever os testes single-org (falham primeiro)**

Em `apps/api/test/procedimentos.test.ts`:

```typescript
it('gets a Procedimento by id', async () => {
  const criado = await request(app.getHttpServer())
    .post('/procedimentos')
    .set('Cookie', cookie)
    .send({ nome: '1ª Aplicação de Fungicida', tipo: 'APLICACAO' })
    .expect(201);

  const obtido = await request(app.getHttpServer())
    .get(`/procedimentos/${criado.body.id}`)
    .set('Cookie', cookie)
    .expect(200);
  expect(obtido.body).toMatchObject({
    nome: '1ª Aplicação de Fungicida',
    tipo: 'APLICACAO',
  });
});

it('updates a Procedimento', async () => {
  const criado = await request(app.getHttpServer())
    .post('/procedimentos')
    .set('Cookie', cookie)
    .send({ nome: 'Aplicação de Herbicida', tipo: 'APLICACAO' })
    .expect(201);

  const atualizado = await request(app.getHttpServer())
    .patch(`/procedimentos/${criado.body.id}`)
    .set('Cookie', cookie)
    .send({ nome: 'Aplicação de Herbicida (revisado)', tipo: 'APLICACAO' })
    .expect(200);
  expect(atualizado.body.nome).toBe('Aplicação de Herbicida (revisado)');
});

it('rejects deleting a Procedimento with Planejamento history', async () => {
  const { talhao, safra, procedimento, insumo } = await criarFixturesAgricolas(
    app,
    cookie,
  );

  await request(app.getHttpServer())
    .post('/planejamentos')
    .set('Cookie', cookie)
    .send({
      safraId: safra.id,
      talhaoId: talhao.id,
      procedimentoId: procedimento.id,
      dataPrevista: new Date(Date.now() + 86400000).toISOString(),
      insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }],
    })
    .expect(201);

  await request(app.getHttpServer())
    .delete(`/procedimentos/${procedimento.id}`)
    .set('Cookie', cookie)
    .expect(400);
});

it('deletes a Procedimento with no history', async () => {
  const criado = await request(app.getHttpServer())
    .post('/procedimentos')
    .set('Cookie', cookie)
    .send({ nome: 'Desfolha', tipo: 'OUTRO' })
    .expect(201);

  await request(app.getHttpServer())
    .delete(`/procedimentos/${criado.body.id}`)
    .set('Cookie', cookie)
    .expect(204);

  await request(app.getHttpServer())
    .get(`/procedimentos/${criado.body.id}`)
    .set('Cookie', cookie)
    .expect(404);
});
```

Em `apps/api/test/isolamento-organizacoes.test.ts`, adicione:

```typescript
it('returns 404 getting a Procedimento from another organization', async () => {
  const { procedimento } = await criarFixturesAgricolas(app, cookieOrgA);

  await request(app.getHttpServer())
    .get(`/procedimentos/${procedimento.id}`)
    .set('Cookie', cookieOrgB)
    .expect(404);
});

it('returns 404 updating a Procedimento from another organization', async () => {
  const { procedimento } = await criarFixturesAgricolas(app, cookieOrgA);

  await request(app.getHttpServer())
    .patch(`/procedimentos/${procedimento.id}`)
    .set('Cookie', cookieOrgB)
    .send({ nome: 'Tentativa', tipo: procedimento.tipo })
    .expect(404);
});

it('returns 404 deleting a Procedimento from another organization', async () => {
  const { procedimento } = await criarFixturesAgricolas(app, cookieOrgA);

  await request(app.getHttpServer())
    .delete(`/procedimentos/${procedimento.id}`)
    .set('Cookie', cookieOrgB)
    .expect(404);
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd apps/api && pnpm test -- procedimentos.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 3: Implementar**

Em `apps/api/src/procedimentos/procedimentos.dto.ts`, adicione:

```typescript
export class UpdateProcedimentoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nome!: string;

  @IsEnum(TipoProcedimento)
  tipo!: TipoProcedimento;
}
```

Em `apps/api/src/procedimentos/procedimentos.service.ts`, adicione o import e os métodos:

```typescript
import { excluirComRestricao } from '../common/excluir-com-restricao';
import type { CreateProcedimentoDto, UpdateProcedimentoDto } from './procedimentos.dto';
// ...
  async getById(id: string): Promise<ProcedimentoResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async update(
    id: string,
    dto: UpdateProcedimentoDto,
  ): Promise<ProcedimentoResponse> {
    await this.getOrThrow(id);
    const procedimento = await this.prisma.procedimento.update({
      where: { id },
      data: { nome: dto.nome, tipo: dto.tipo },
    });
    return this.toResponse(procedimento);
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await excluirComRestricao(() =>
      this.prisma.procedimento.delete({ where: { id } }),
    );
  }
```

Em `apps/api/src/procedimentos/procedimentos.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateProcedimentoDto,
  UpdateProcedimentoDto,
} from './procedimentos.dto';
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

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProcedimentoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `cd apps/api && pnpm test -- procedimentos.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/procedimentos/procedimentos.dto.ts apps/api/src/procedimentos/procedimentos.service.ts apps/api/src/procedimentos/procedimentos.controller.ts apps/api/test/procedimentos.test.ts apps/api/test/isolamento-organizacoes.test.ts
git commit -m "feat(api): adiciona GET por id, PATCH e DELETE em Procedimento"
```

---

### Task 5: GET por id e DELETE em Insumo

**Files:**

- Modify: `apps/api/src/insumos/insumos.service.ts`
- Modify: `apps/api/src/insumos/insumos.controller.ts`
- Test: `apps/api/test/insumos.test.ts`
- Test: `apps/api/test/isolamento-organizacoes.test.ts`

**Interfaces:**

- Consumes: `excluirComRestricao` (Task 1). `InsumosService.getOrThrow` já existe (usado internamente); esta task só expõe via rota.

Insumo já tem `getOrThrow` (usado por `updatePreco`) — só falta a rota `GET /insumos/:id`. O PATCH continua só-preço, sem mudança.

- [ ] **Step 1: Escrever os testes single-org (falham primeiro)**

Em `apps/api/test/insumos.test.ts`:

```typescript
it('gets an Insumo by id', async () => {
  const criado = await request(app.getHttpServer())
    .post('/insumos')
    .set('Cookie', cookie)
    .send({ nome: 'Fox Supra', unidade: 'litro', precoUnitarioAtual: 100 })
    .expect(201);

  const obtido = await request(app.getHttpServer())
    .get(`/insumos/${criado.body.id}`)
    .set('Cookie', cookie)
    .expect(200);
  expect(obtido.body).toMatchObject({ nome: 'Fox Supra', unidade: 'litro' });
});

it('rejects deleting an Insumo referenced by a CompraInsumo', async () => {
  const { talhao, safra, insumo } = await criarFixturesAgricolas(app, cookie);

  await request(app.getHttpServer())
    .post('/compras-insumo')
    .set('Cookie', cookie)
    .send({
      talhaoId: talhao.id,
      safraId: safra.id,
      insumoId: insumo.id,
      data: new Date().toISOString(),
      quantidade: 10,
    })
    .expect(201);

  await request(app.getHttpServer())
    .delete(`/insumos/${insumo.id}`)
    .set('Cookie', cookie)
    .expect(400);
});

it('deletes an Insumo with no history', async () => {
  const criado = await request(app.getHttpServer())
    .post('/insumos')
    .set('Cookie', cookie)
    .send({ nome: 'Adubo X', unidade: 'kg', precoUnitarioAtual: 5 })
    .expect(201);

  await request(app.getHttpServer())
    .delete(`/insumos/${criado.body.id}`)
    .set('Cookie', cookie)
    .expect(204);

  await request(app.getHttpServer())
    .get(`/insumos/${criado.body.id}`)
    .set('Cookie', cookie)
    .expect(404);
});
```

Em `apps/api/test/isolamento-organizacoes.test.ts`, adicione:

```typescript
it('returns 404 getting an Insumo from another organization', async () => {
  const { insumo } = await criarFixturesAgricolas(app, cookieOrgA);

  await request(app.getHttpServer())
    .get(`/insumos/${insumo.id}`)
    .set('Cookie', cookieOrgB)
    .expect(404);
});

it('returns 404 deleting an Insumo from another organization', async () => {
  const { insumo } = await criarFixturesAgricolas(app, cookieOrgA);

  await request(app.getHttpServer())
    .delete(`/insumos/${insumo.id}`)
    .set('Cookie', cookieOrgB)
    .expect(404);
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd apps/api && pnpm test -- insumos.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 3: Implementar**

Em `apps/api/src/insumos/insumos.service.ts`, adicione o import e os métodos:

```typescript
import { excluirComRestricao } from '../common/excluir-com-restricao';
// ...
  async getById(id: string): Promise<InsumoResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await excluirComRestricao(() =>
      this.prisma.insumo.delete({ where: { id } }),
    );
  }
```

Em `apps/api/src/insumos/insumos.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
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

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  updatePreco(@Param('id') id: string, @Body() dto: UpdateInsumoPrecoDto) {
    return this.service.updatePreco(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `cd apps/api && pnpm test -- insumos.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/insumos/insumos.service.ts apps/api/src/insumos/insumos.controller.ts apps/api/test/insumos.test.ts apps/api/test/isolamento-organizacoes.test.ts
git commit -m "feat(api): adiciona GET por id e DELETE em Insumo"
```

---

### Task 6: DELETE condicional em Planejamento

**Files:**

- Modify: `apps/api/src/planejamentos/planejamentos.service.ts`
- Modify: `apps/api/src/planejamentos/planejamentos.controller.ts`
- Test: `apps/api/test/planejamentos.test.ts`
- Test: `apps/api/test/isolamento-organizacoes.test.ts`

**Interfaces:**

- Consumes: `excluirComRestricao` (Task 1). `PlanejamentosService.getOrThrow` já existe e já inclui `execucoes: { select: { id: true } }` no `PLANEJAMENTO_INCLUDE` — a checagem "já foi executado" é só `item.execucoes.length > 0`, sem query extra.

Diferente das outras tasks: aqui a restrição não vem do banco (RESTRICT), vem de uma regra de negócio — um Planejamento com Execução vinculada não pode ser apagado, mesmo que o banco deixasse (a FK de `ExecucaoItem.planejamentoItemId` é `SetNull`, não RESTRICT, então o banco _deixaria_ apagar e só desvincularia a Execução — o que apagaria silenciosamente o rastro do planejamento original de um registro financeiro real. Por isso a checagem é feita no service, antes de qualquer delete).

- [ ] **Step 1: Escrever os testes single-org (falham primeiro)**

Em `apps/api/test/planejamentos.test.ts`:

```typescript
it('rejects deleting a Planejamento that was already executed', async () => {
  const { talhao, safra, procedimento, insumo } = await criarFixturesAgricolas(
    app,
    cookie,
  );

  const planejamento = await request(app.getHttpServer())
    .post('/planejamentos')
    .set('Cookie', cookie)
    .send({
      safraId: safra.id,
      talhaoId: talhao.id,
      procedimentoId: procedimento.id,
      dataPrevista: new Date(Date.now() + 86400000).toISOString(),
      insumos: [{ insumoId: insumo.id, dosePorHa: 0.35 }],
    })
    .expect(201);

  await request(app.getHttpServer())
    .post('/execucoes')
    .set('Cookie', cookie)
    .send({
      safraId: safra.id,
      talhaoId: talhao.id,
      procedimentoId: procedimento.id,
      planejamentoItemId: planejamento.body.id,
      data: new Date().toISOString(),
      insumos: [{ insumoId: insumo.id, quantidade: 700 }],
    })
    .expect(201);

  await request(app.getHttpServer())
    .delete(`/planejamentos/${planejamento.body.id}`)
    .set('Cookie', cookie)
    .expect(400);
});

it('deletes a Planejamento that was never executed', async () => {
  const { talhao, safra, procedimento, insumo } = await criarFixturesAgricolas(
    app,
    cookie,
  );

  const planejamento = await request(app.getHttpServer())
    .post('/planejamentos')
    .set('Cookie', cookie)
    .send({
      safraId: safra.id,
      talhaoId: talhao.id,
      procedimentoId: procedimento.id,
      dataPrevista: new Date(Date.now() + 86400000).toISOString(),
      insumos: [{ insumoId: insumo.id, dosePorHa: 0.35 }],
    })
    .expect(201);

  await request(app.getHttpServer())
    .delete(`/planejamentos/${planejamento.body.id}`)
    .set('Cookie', cookie)
    .expect(204);

  await request(app.getHttpServer())
    .get(`/planejamentos/${planejamento.body.id}`)
    .set('Cookie', cookie)
    .expect(404);
});
```

Em `apps/api/test/isolamento-organizacoes.test.ts`, adicione:

```typescript
it('returns 404 deleting a Planejamento from another organization', async () => {
  const { talhao, safra, procedimento, insumo } = await criarFixturesAgricolas(
    app,
    cookieOrgA,
  );

  const planejamento = await request(app.getHttpServer())
    .post('/planejamentos')
    .set('Cookie', cookieOrgA)
    .send({
      safraId: safra.id,
      talhaoId: talhao.id,
      procedimentoId: procedimento.id,
      dataPrevista: new Date(Date.now() + 86400000).toISOString(),
      insumos: [{ insumoId: insumo.id, dosePorHa: 0.35 }],
    })
    .expect(201);

  await request(app.getHttpServer())
    .delete(`/planejamentos/${planejamento.body.id}`)
    .set('Cookie', cookieOrgB)
    .expect(404);
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd apps/api && pnpm test -- planejamentos.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 3: Implementar**

Em `apps/api/src/planejamentos/planejamentos.service.ts`, adicione o import e o método (reaproveita `getOrThrow`, que já retorna `execucoes: { id: true }[]` via `PLANEJAMENTO_INCLUDE`):

```typescript
import { excluirComRestricao } from '../common/excluir-com-restricao';
// ...
  async remove(id: string): Promise<void> {
    const item = await this.getOrThrow(id);
    if (item.execucoes.length > 0) {
      throw new BadRequestException(
        'Não é possível excluir um planejamento já executado',
      );
    }
    await excluirComRestricao(() =>
      this.prisma.planejamentoItem.delete({ where: { id } }),
    );
  }
```

Em `apps/api/src/planejamentos/planejamentos.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
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

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `cd apps/api && pnpm test -- planejamentos.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/planejamentos/planejamentos.service.ts apps/api/src/planejamentos/planejamentos.controller.ts apps/api/test/planejamentos.test.ts apps/api/test/isolamento-organizacoes.test.ts
git commit -m "feat(api): adiciona DELETE condicional em Planejamento não executado"
```

---

### Task 7: GET por id em Execução

**Files:**

- Modify: `apps/api/src/execucoes/execucoes.service.ts`
- Modify: `apps/api/src/execucoes/execucoes.controller.ts`
- Test: `apps/api/test/execucoes.test.ts`
- Test: `apps/api/test/isolamento-organizacoes.test.ts`

**Interfaces:**

- Produces: `ExecucoesService.getOrThrow(id)`/`getById(id)` — mesma forma dos demais, usado só internamente por enquanto (nenhuma outra task desta rodada depende disso).

Execução não tem `getOrThrow` ainda (nunca precisou). Esta task só adiciona leitura — sem PATCH, sem DELETE (imutável por design, seção 2 da spec).

- [ ] **Step 1: Escrever os testes single-org (falham primeiro)**

Em `apps/api/test/execucoes.test.ts`:

```typescript
it('gets an Execução by id', async () => {
  const { talhao, safra, procedimento, insumo } = await criarFixturesAgricolas(
    app,
    cookie,
  );

  const execucao = await request(app.getHttpServer())
    .post('/execucoes')
    .set('Cookie', cookie)
    .send({
      safraId: safra.id,
      talhaoId: talhao.id,
      procedimentoId: procedimento.id,
      data: new Date().toISOString(),
      insumos: [{ insumoId: insumo.id, quantidade: 10 }],
    })
    .expect(201);

  const obtida = await request(app.getHttpServer())
    .get(`/execucoes/${execucao.body.id}`)
    .set('Cookie', cookie)
    .expect(200);
  expect(obtida.body.id).toBe(execucao.body.id);
});
```

Em `apps/api/test/isolamento-organizacoes.test.ts`, adicione:

```typescript
it('returns 404 getting an Execução from another organization', async () => {
  const orgA = await criarFixturesAgricolas(app, cookieOrgA);
  const execucao = await request(app.getHttpServer())
    .post('/execucoes')
    .set('Cookie', cookieOrgA)
    .send({
      safraId: orgA.safra.id,
      talhaoId: orgA.talhao.id,
      procedimentoId: orgA.procedimento.id,
      data: new Date().toISOString(),
      insumos: [{ insumoId: orgA.insumo.id, quantidade: 10 }],
    })
    .expect(201);

  await request(app.getHttpServer())
    .get(`/execucoes/${execucao.body.id}`)
    .set('Cookie', cookieOrgB)
    .expect(404);
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd apps/api && pnpm test -- execucoes.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 3: Implementar**

Em `apps/api/src/execucoes/execucoes.service.ts`, adicione os métodos (não precisa de `excluirComRestricao` — não há DELETE):

```typescript
  async getOrThrow(id: string): Promise<ExecucaoRow> {
    const organizacaoId = await this.currentOrg.getId();
    const item = await this.prisma.execucaoItem.findFirst({
      where: { id, organizacaoId },
      include: EXECUCAO_INCLUDE,
    });
    if (!item) throw new NotFoundException('Execução não encontrada');
    return item;
  }

  async getById(id: string): Promise<ExecucaoResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }
```

Em `apps/api/src/execucoes/execucoes.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `cd apps/api && pnpm test -- execucoes.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/execucoes/execucoes.service.ts apps/api/src/execucoes/execucoes.controller.ts apps/api/test/execucoes.test.ts apps/api/test/isolamento-organizacoes.test.ts
git commit -m "feat(api): adiciona GET por id em Execução"
```

---

### Task 8: GET por id em Compra de Insumo

**Files:**

- Modify: `apps/api/src/compras-insumo/compras-insumo.service.ts`
- Modify: `apps/api/src/compras-insumo/compras-insumo.controller.ts`
- Test: `apps/api/test/compras-insumo.test.ts`
- Test: `apps/api/test/isolamento-organizacoes.test.ts`

**Interfaces:**

- Produces: `ComprasInsumoService.getOrThrow(id)`/`getById(id)`.

Mesma lógica da Task 7 — só leitura, sem PATCH/DELETE (imutável por design).

- [ ] **Step 1: Escrever os testes single-org (falham primeiro)**

Em `apps/api/test/compras-insumo.test.ts`:

```typescript
it('gets a CompraInsumo by id', async () => {
  const { talhao, safra, insumo } = await criarFixturesAgricolas(app, cookie);

  const compra = await request(app.getHttpServer())
    .post('/compras-insumo')
    .set('Cookie', cookie)
    .send({
      talhaoId: talhao.id,
      safraId: safra.id,
      insumoId: insumo.id,
      data: new Date().toISOString(),
      quantidade: 10,
    })
    .expect(201);

  const obtida = await request(app.getHttpServer())
    .get(`/compras-insumo/${compra.body.id}`)
    .set('Cookie', cookie)
    .expect(200);
  expect(obtida.body.id).toBe(compra.body.id);
});
```

Em `apps/api/test/isolamento-organizacoes.test.ts`, adicione:

```typescript
it('returns 404 getting a CompraInsumo from another organization', async () => {
  const orgA = await criarFixturesAgricolas(app, cookieOrgA);
  const compra = await request(app.getHttpServer())
    .post('/compras-insumo')
    .set('Cookie', cookieOrgA)
    .send({
      talhaoId: orgA.talhao.id,
      safraId: orgA.safra.id,
      insumoId: orgA.insumo.id,
      data: new Date().toISOString(),
      quantidade: 10,
    })
    .expect(201);

  await request(app.getHttpServer())
    .get(`/compras-insumo/${compra.body.id}`)
    .set('Cookie', cookieOrgB)
    .expect(404);
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd apps/api && pnpm test -- compras-insumo.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 3: Implementar**

Em `apps/api/src/compras-insumo/compras-insumo.service.ts`, adicione os métodos:

```typescript
  async getOrThrow(id: string): Promise<CompraInsumoRow> {
    const organizacaoId = await this.currentOrg.getId();
    const compra = await this.prisma.compraInsumo.findFirst({
      where: { id, organizacaoId },
    });
    if (!compra) throw new NotFoundException('Compra de insumo não encontrada');
    return compra;
  }

  async getById(id: string): Promise<CompraInsumoResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }
```

Em `apps/api/src/compras-insumo/compras-insumo.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `cd apps/api && pnpm test -- compras-insumo.test.ts isolamento-organizacoes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/compras-insumo/compras-insumo.service.ts apps/api/src/compras-insumo/compras-insumo.controller.ts apps/api/test/compras-insumo.test.ts apps/api/test/isolamento-organizacoes.test.ts
git commit -m "feat(api): adiciona GET por id em Compra de Insumo"
```

---

### Task 9: Documentação

**Files:**

- Modify: `docs/API.md` (confira o formato exato antes de editar)
- Modify: `docs/DATABASE.md`
- Modify: `docs/BACKLOG.md` (item #6)

**Interfaces:**

- Consumes: resultado final de todas as tasks anteriores.

- [ ] **Step 1: Atualizar a lista de rotas na documentação da API**

Leia `docs/API.md` primeiro pra confirmar o formato atual. Adicione as rotas novas de cada entidade (DELETE em Propriedade/Talhão/Safra/Procedimento/Insumo/Planejamento condicional; GET por id em Procedimento/Insumo/Execução/CompraInsumo; PATCH em Procedimento), seguindo o mesmo formato já usado pras rotas existentes.

- [ ] **Step 2: Atualizar `docs/DATABASE.md`**

Adicione uma nota curta: a trava `ON DELETE RESTRICT` (seção já existente sobre o backlog #6) agora é exercitada de verdade pelas rotas DELETE — não é mais só teórica.

- [ ] **Step 3: Atualizar `docs/BACKLOG.md` item #6**

O texto atual diz "Sem rota DELETE hoje, então não é explorável ainda". Atualize pra refletir que as rotas DELETE existem agora, respeitando a trava, com teste de regressão por entidade provando que a trava funciona (criar vínculo → 400; sem vínculo → 204).

- [ ] **Step 4: Commit**

```bash
git add docs/API.md docs/DATABASE.md docs/BACKLOG.md
git commit -m "docs: documenta CRUD completo do domínio agrícola"
```

---

## Self-review

**Cobertura da spec:** DELETE nas 5 entidades de catálogo (Tasks 1-5) + Planejamento condicional (Task 6) +
GET por id onde faltava (Tasks 4, 5, 7, 8) + PATCH completo em Procedimento (Task 4) — todas as decisões da
spec (semântica de delete, imutabilidade de Execução/CompraInsumo, exceção do Planejamento não executado,
sem distinção de papel) estão refletidas nas tasks correspondentes. O helper `excluirComRestricao` (Task 1) é
consumido por 5 das 6 tasks de DELETE, evitando duplicar a tradução de `P2003`.

**Placeholders:** nenhum "TBD"/"similar a" — toda task tem o código completo, incluindo o teste de isolamento
cross-org específico de cada rota nova (adicionado em `isolamento-organizacoes.test.ts` task a task, em vez
de duplicar o setup de duas organizações em 7 arquivos de teste diferentes).

**Consistência de tipos:** `excluirComRestricao(deleteFn: () => Promise<unknown>): Promise<void>` é usado com
a mesma assinatura em todas as 5 tasks que o consomem. `getOrThrow`/`getById` seguem o mesmo par de nomes em
todas as 4 entidades que ganham leitura por id nesta rodada, consistente com as 4 que já tinham. Toda task que
toca `isolamento-organizacoes.test.ts` reaproveita exatamente `cookieOrgA`/`cookieOrgB` e `criarFixturesAgricolas`
já estabelecidos no arquivo — nenhuma reintroduz um padrão de duas organizações diferente.

**Risco de conflito entre tasks:** todas as 8 tasks (exceto a 9, documentação) modificam
`apps/api/test/isolamento-organizacoes.test.ts` — como a execução é sequencial (subagent-driven-development
nunca despacha duas implementações em paralelo), cada task sempre parte do estado mais recente desse arquivo,
sem risco de sobrescrita.

## Execução

Plano completo e salvo em `docs/superpowers/plans/2026-10-14-crud-completo-dominio.md`. Duas opções de execução:

**1. Subagent-Driven (recomendado)** — eu disparo um subagente novo por task, revisão entre tasks, iteração rápida.

**2. Execução inline** — executo as tasks nesta sessão via executing-plans, em lotes com checkpoints de revisão.

Qual abordagem?
