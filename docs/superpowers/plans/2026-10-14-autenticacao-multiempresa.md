# Autenticação e Multiempresa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao AGRO autenticação real e multiempresa — admin de sistema provisiona organizações e seus primeiros usuários; usuários chefes (ORG_ADMIN) gerenciam os próprios membros; as 8 rotas do domínio agrícola existentes passam a exigir sessão e ficam de fato isoladas por organização.

**Architecture:** Dois mundos de sessão paralelos e independentes (admin de sistema vs. usuário de organização), cada um com sua própria tabela de credencial e sua própria tabela de sessão revogável no Postgres, resolvidos por guards NestJS que leem um cookie `httpOnly` e anexam o contexto ao request. `CurrentOrganizationService` passa a ler esse contexto em vez de um slug fixo. Todo lookup por id nas 8 entidades existentes ganha filtro por organização — incluindo Talhão, que chega lá só pela relação com Propriedade.

**Tech Stack:** NestJS 11, Prisma 6.19.3, PostgreSQL 17, `bcryptjs` (hash de senha — ver nota abaixo), `cookie-parser`, `@nestjs/throttler`, Next.js 16.

**Spec:** `docs/superpowers/specs/2026-10-14-autenticacao-multiempresa-design.md`

## Global Constraints

- Conventional Commits em cada task; hooks de lint-staged/commitlint já configurados, não pular com `--no-verify`.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter @agro/api test`, `pnpm build` precisam passar antes de considerar uma task terminada.
- Sem migrations destrutivas. `prisma migrate dev` não funciona neste ambiente (sem TTY) — toda migration é escrita à mão no formato que o Prisma gera (ver migrations existentes em `apps/api/prisma/migrations/`) e aplicada via `pnpm --filter @agro/api db:migrate:deploy`, **nos dois bancos**: o de desenvolvimento (`.env`, banco `agro`) e o de teste (`.env.test`, banco `agro_test` — usar `DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d= -f2-) npx prisma migrate deploy` a partir de `apps/api/`).
- `bcryptjs` (não `bcrypt`): puro JavaScript, sem binding nativo. Esta sessão já teve dor real com binários nativos em build Docker multi-stage (o engine do Prisma) — evitar reintroduzir a mesma classe de problema para hash de senha, que não tem exigência de performance que justifique a versão nativa neste volume de usuários.
- Toda nova entidade de credencial (`AdminSistema`, `Usuario`) usa `senhaHash` (nunca armazenar a senha em texto puro, nem logar).
- Decimal/preço não entra neste plano — é scope do domínio agrícola, já tratado em trabalho anterior.
- Arquivos de teste seguem o padrão existente: `supertest` contra uma app Nest real + Postgres real, `limparBanco()` em `beforeEach`, helpers compartilhados em `apps/api/test/support/`.

---

## Mapa de arquivos

Novos:

```
apps/api/src/auth/
  auth-context.ts            # tipo AuthContext + augmentação do Request do Express
  current-user.service.ts    # request-scoped: expõe {usuarioId, organizacaoId, papel}
  auth.guard.ts               # lê cookie agro_session, resolve SessaoUsuario
  auth.controller.ts          # POST /auth/login, POST /auth/logout
  auth.service.ts             # lógica de login/logout de Usuario
  auth.module.ts
  auth.dto.ts                 # LoginDto

apps/api/src/usuarios/
  usuarios.controller.ts      # GET+POST /usuarios
  usuarios.service.ts
  usuarios.module.ts
  usuarios.dto.ts              # CreateUsuarioDto

apps/api/src/admin-sistema/
  bootstrap-env.ts             # lê/valida ADMIN_BOOTSTRAP_EMAIL/PASSWORD
  admin-bootstrap.service.ts   # OnModuleInit: cria o 1º AdminSistema se não existir
  admin-auth.guard.ts          # lê cookie agro_admin_session, resolve SessaoAdminSistema
  admin-auth.controller.ts     # POST /admin/auth/login, POST /admin/auth/logout
  admin-auth.service.ts
  admin-organizacoes.controller.ts  # GET+POST /admin/organizacoes
  admin-organizacoes.service.ts
  admin-sistema.module.ts
  admin-sistema.dto.ts          # AdminLoginDto, CreateOrganizacaoDto

apps/api/src/common/
  senha.ts                      # hashSenha/verificarSenha (bcryptjs)

packages/contracts/src/
  usuario.ts                    # usuarioResponseSchema
  organizacao-admin.ts          # organizacaoAdminResponseSchema

apps/web/src/
  lib/auth.ts                   # login/logout (usuário), credentials:'include'
  lib/admin.ts                  # login (admin), criar/listar organizações
  app/login/page.tsx
  app/admin/login/page.tsx
  app/usuarios/page.tsx
  app/admin/organizacoes/page.tsx

apps/api/test/support/
  autenticar.ts                 # helpers de teste: cria sessão direto via Prisma
```

Modificados: `apps/api/prisma/schema.prisma`, `apps/api/src/organizacao/current-organization.service.ts`,
`apps/api/src/setup.ts` (cookie-parser, CORS credentials), `apps/api/src/app.module.ts`, `apps/api/src/main.ts`,
`apps/api/package.json`, `apps/web/package.json`, `turbo.json`, `.github/workflows/ci.yml`,
`apps/api/.env.test`/`.env.test.example`, todos os 8 módulos de serviço do domínio + seus 11 arquivos de
teste existentes (lista exata na Task 6), `docs/AUTH.md`, `docs/DOMAIN.md`, `docs/FLUXOS.md`, `docs/DATABASE.md`,
`docs/BACKLOG.md`, `README.md`.

---

### Task 1: Modelo de dados e migration

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261014100000_add_autenticacao_multiempresa/migration.sql`
- Test: `apps/api/test/schema-auth.test.ts`

**Interfaces:**

- Produces: modelos Prisma `AdminSistema`, `SessaoAdminSistema`, `Usuario`, `SessaoUsuario`, enum
  `PapelUsuario` (`ORG_ADMIN` | `ORG_MEMBER`), campo `Organizacao.maxUsuarios` (`Int`, default `5`). Usados por
  todas as tasks seguintes.

- [ ] **Step 1: Adicionar os modelos ao schema**

Em `apps/api/prisma/schema.prisma`, adicione ao final do arquivo:

```prisma
model AdminSistema {
  id        String   @id @default(cuid())
  email     String   @unique
  senhaHash String
  createdAt DateTime @default(now())

  sessoes SessaoAdminSistema[]
}

model SessaoAdminSistema {
  id         String    @id @default(cuid())
  adminId    String
  expiraEm   DateTime
  revogadaEm DateTime?
  createdAt  DateTime  @default(now())

  admin AdminSistema @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@index([adminId])
}

enum PapelUsuario {
  ORG_ADMIN
  ORG_MEMBER
}

model Usuario {
  id            String       @id @default(cuid())
  organizacaoId String
  email         String       @unique
  senhaHash     String
  papel         PapelUsuario
  createdAt     DateTime     @default(now())

  organizacao Organizacao     @relation(fields: [organizacaoId], references: [id], onDelete: Cascade)
  sessoes     SessaoUsuario[]

  @@index([organizacaoId])
}

model SessaoUsuario {
  id         String    @id @default(cuid())
  usuarioId  String
  expiraEm   DateTime
  revogadaEm DateTime?
  createdAt  DateTime  @default(now())

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@index([usuarioId])
}
```

No `model Organizacao` existente, adicione o campo e a relação (junto aos campos/relações já existentes, não
substitua nada):

```prisma
  maxUsuarios Int @default(5)
```

e, no bloco de relações do mesmo model, adicione:

```prisma
  usuarios Usuario[]
```

- [ ] **Step 2: Validar o schema**

Run: `cd apps/api && pnpm db:validate`
Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 3: Escrever a migration à mão**

Crie o diretório `apps/api/prisma/migrations/20261014100000_add_autenticacao_multiempresa/` com
`migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Organizacao" ADD COLUMN "maxUsuarios" INTEGER NOT NULL DEFAULT 5;

-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('ORG_ADMIN', 'ORG_MEMBER');

-- CreateTable
CREATE TABLE "AdminSistema" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoAdminSistema" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoAdminSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminSistema_email_key" ON "AdminSistema"("email");

-- CreateIndex
CREATE INDEX "SessaoAdminSistema_adminId_idx" ON "SessaoAdminSistema"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_organizacaoId_idx" ON "Usuario"("organizacaoId");

-- CreateIndex
CREATE INDEX "SessaoUsuario_usuarioId_idx" ON "SessaoUsuario"("usuarioId");

-- AddForeignKey
ALTER TABLE "SessaoAdminSistema" ADD CONSTRAINT "SessaoAdminSistema_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminSistema"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoUsuario" ADD CONSTRAINT "SessaoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Aplicar no banco de desenvolvimento**

Run: `cd apps/api && pnpm db:migrate:deploy`
Expected: `All migrations have been successfully applied.`

- [ ] **Step 5: Aplicar no banco de teste**

Run: `cd apps/api && DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d= -f2-) npx prisma migrate deploy`
Expected: mesma mensagem de sucesso, contra `agro_test`.

- [ ] **Step 6: Gerar o client**

Run: `cd apps/api && pnpm db:generate`
Expected: `Generated Prisma Client`

- [ ] **Step 7: Escrever o teste de schema**

Crie `apps/api/test/schema-auth.test.ts`:

```typescript
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Schema de autenticação', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.sessaoUsuario.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.sessaoAdminSistema.deleteMany();
    await prisma.adminSistema.deleteMany();
  });

  it('Organizacao tem maxUsuarios com default 5', async () => {
    const organizacao = await prisma.organizacao.create({
      data: { slug: `teste-${Date.now()}`, nome: 'Org de teste' },
    });
    expect(organizacao.maxUsuarios).toBe(5);
  });

  it('rejects two AdminSistema with the same email', async () => {
    await prisma.adminSistema.create({
      data: { email: 'admin@teste.com', senhaHash: 'hash' },
    });
    await expect(
      prisma.adminSistema.create({
        data: { email: 'admin@teste.com', senhaHash: 'outro-hash' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects two Usuario with the same email', async () => {
    const organizacao = await prisma.organizacao.create({
      data: { slug: `teste-${Date.now()}`, nome: 'Org de teste' },
    });
    await prisma.usuario.create({
      data: {
        organizacaoId: organizacao.id,
        email: 'usuario@teste.com',
        senhaHash: 'hash',
        papel: 'ORG_ADMIN',
      },
    });
    await expect(
      prisma.usuario.create({
        data: {
          organizacaoId: organizacao.id,
          email: 'usuario@teste.com',
          senhaHash: 'outro-hash',
          papel: 'ORG_MEMBER',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
```

- [ ] **Step 8: Rodar o teste**

Run: `cd apps/api && pnpm test -- schema-auth.test.ts`
Expected: 3 testes passando.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20261014100000_add_autenticacao_multiempresa apps/api/test/schema-auth.test.ts
git commit -m "feat(api): adiciona modelo de dados de autenticação e multiempresa"
```

---

### Task 2: Hash de senha

**Files:**

- Create: `apps/api/src/common/senha.ts`
- Test: `apps/api/test/senha.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**

- Produces: `hashSenha(senha: string): Promise<string>`, `verificarSenha(senha: string, hash: string): Promise<boolean>`. Usado pelas Tasks 3 e 4.

- [ ] **Step 1: Instalar bcryptjs**

Run: `cd apps/api && pnpm add bcryptjs && pnpm add -D @types/bcryptjs`

- [ ] **Step 2: Escrever o teste**

Crie `apps/api/test/senha.test.ts`:

```typescript
import { hashSenha, verificarSenha } from '../src/common/senha';

describe('hash de senha', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashSenha('senha-correta-123');
    await expect(verificarSenha('senha-correta-123', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password against the hash', async () => {
    const hash = await hashSenha('senha-correta-123');
    await expect(verificarSenha('senha-errada', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (salt aleatório)', async () => {
    const hash1 = await hashSenha('mesma-senha');
    const hash2 = await hashSenha('mesma-senha');
    expect(hash1).not.toBe(hash2);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd apps/api && pnpm test -- senha.test.ts`
Expected: FAIL com "Cannot find module '../src/common/senha'"

- [ ] **Step 4: Implementar**

Crie `apps/api/src/common/senha.ts`:

```typescript
import { hash, compare } from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashSenha(senha: string): Promise<string> {
  return hash(senha, SALT_ROUNDS);
}

export async function verificarSenha(
  senha: string,
  senhaHash: string,
): Promise<boolean> {
  return compare(senha, senhaHash);
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd apps/api && pnpm test -- senha.test.ts`
Expected: 3 testes passando.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/senha.ts apps/api/test/senha.test.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): adiciona helper de hash de senha com bcryptjs"
```

---

### Task 3: Admin de sistema — bootstrap, login e portal de organizações

**Files:**

- Create: `apps/api/src/admin-sistema/bootstrap-env.ts`
- Create: `apps/api/src/admin-sistema/admin-bootstrap.service.ts`
- Create: `apps/api/src/admin-sistema/admin-auth.guard.ts`
- Create: `apps/api/src/admin-sistema/admin-auth.controller.ts`
- Create: `apps/api/src/admin-sistema/admin-auth.service.ts`
- Create: `apps/api/src/admin-sistema/admin-organizacoes.controller.ts`
- Create: `apps/api/src/admin-sistema/admin-organizacoes.service.ts`
- Create: `apps/api/src/admin-sistema/admin-sistema.dto.ts`
- Create: `apps/api/src/admin-sistema/admin-sistema.module.ts`
- Create: `packages/contracts/src/organizacao-admin.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/setup.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`, `apps/api/.env.test`, `apps/api/.env.test.example`, `turbo.json`, `.github/workflows/ci.yml`
- Test: `apps/api/test/admin-sistema.test.ts`

**Interfaces:**

- Consumes: `hashSenha`/`verificarSenha` (Task 2).
- Produces: `POST /admin/auth/login`, `POST /admin/auth/logout`, `POST /admin/organizacoes`,
  `GET /admin/organizacoes`. `AdminAuthGuard` (reutilizável, mas não é reutilizado por nenhuma outra task).

- [ ] **Step 1: Instalar cookie-parser**

Run: `cd apps/api && pnpm add cookie-parser && pnpm add -D @types/cookie-parser`

- [ ] **Step 2: Registrar o middleware em `setup.ts`**

Em `apps/api/src/setup.ts`, adicione o import e a chamada (dentro de `configureApp`, antes de
`app.enableCors`):

```typescript
import cookieParser from 'cookie-parser';
// ...
export function configureApp(app: INestApplication, origin: string) {
  app.use(cookieParser());
  app.enableCors({
    origin,
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  });
  // ...resto do arquivo sem mudança...
```

(note: `credentials: false` virou `true` — necessário para o navegador enviar/receber os cookies de sessão
entre `apps/web` e `apps/api`.)

- [ ] **Step 3: Leitor das variáveis de bootstrap**

Crie `apps/api/src/admin-sistema/bootstrap-env.ts`:

```typescript
import { z } from 'zod';

const bootstrapEnvSchema = z.object({
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
});

export interface AdminBootstrapEnv {
  email?: string;
  senha?: string;
}

export function readAdminBootstrapEnv(
  input: Record<string, string | undefined>,
): AdminBootstrapEnv {
  const result = bootstrapEnvSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      'ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD inválidos: ' +
        result.error.issues.map((issue) => issue.path.join('.')).join(', '),
    );
  }
  return {
    email: result.data.ADMIN_BOOTSTRAP_EMAIL,
    senha: result.data.ADMIN_BOOTSTRAP_PASSWORD,
  };
}
```

- [ ] **Step 4: Serviço de bootstrap**

Crie `apps/api/src/admin-sistema/admin-bootstrap.service.ts`:

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { hashSenha } from '../common/senha';
import { PrismaService } from '../prisma/prisma.service';
import { readAdminBootstrapEnv } from './bootstrap-env';

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const existentes = await this.prisma.adminSistema.count();
    if (existentes > 0) return;

    const { email, senha } = readAdminBootstrapEnv(process.env);
    if (!email || !senha) {
      throw new Error(
        'Nenhum AdminSistema existe e ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD não foram definidos — ' +
          'a aplicação não pode subir sem um jeito de logar como admin de sistema.',
      );
    }

    await this.prisma.adminSistema.create({
      data: { email, senhaHash: await hashSenha(senha) },
    });
    this.logger.log(`AdminSistema inicial criado: ${email}`);
  }
}
```

- [ ] **Step 5: DTOs**

Crie `apps/api/src/admin-sistema/admin-sistema.dto.ts`:

```typescript
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  senha!: string;
}

export class CreateOrganizacaoDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsInt()
  @Min(1)
  maxUsuarios!: number;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminSenha!: string;
}
```

- [ ] **Step 6: Contrato de resposta de Organizacao (visão admin)**

Crie `packages/contracts/src/organizacao-admin.ts`:

```typescript
import { z } from 'zod';

export const organizacaoAdminResponseSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    maxUsuarios: z.number().int(),
    totalUsuarios: z.number().int(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type OrganizacaoAdminResponse = z.infer<
  typeof organizacaoAdminResponseSchema
>;
```

Adicione `export * from './organizacao-admin';` em `packages/contracts/src/index.ts`.

- [ ] **Step 7: AdminAuthGuard**

Crie `apps/api/src/admin-sistema/admin-auth.guard.ts`:

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const SESSAO_DURACAO_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessaoId = request.cookies?.['agro_admin_session'] as
      string | undefined;
    if (!sessaoId) {
      throw new UnauthorizedException('Sessão de admin não encontrada');
    }

    const sessao = await this.prisma.sessaoAdminSistema.findFirst({
      where: { id: sessaoId, revogadaEm: null, expiraEm: { gt: new Date() } },
    });
    if (!sessao) {
      throw new UnauthorizedException('Sessão de admin inválida ou expirada');
    }

    await this.prisma.sessaoAdminSistema.update({
      where: { id: sessao.id },
      data: { expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS) },
    });

    (request as Request & { adminId: string }).adminId = sessao.adminId;
    return true;
  }
}
```

- [ ] **Step 8: Serviço e controller de login de admin**

Crie `apps/api/src/admin-sistema/admin-auth.service.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verificarSenha } from '../common/senha';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminLoginDto } from './admin-sistema.dto';

const SESSAO_DURACAO_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: AdminLoginDto): Promise<string> {
    const admin = await this.prisma.adminSistema.findUnique({
      where: { email: dto.email },
    });
    if (!admin || !(await verificarSenha(dto.senha, admin.senhaHash))) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }
    const sessao = await this.prisma.sessaoAdminSistema.create({
      data: {
        adminId: admin.id,
        expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS),
      },
    });
    return sessao.id;
  }

  async logout(sessaoId: string): Promise<void> {
    await this.prisma.sessaoAdminSistema.updateMany({
      where: { id: sessaoId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }
}
```

Crie `apps/api/src/admin-sistema/admin-auth.controller.ts`:

```typescript
import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './admin-sistema.dto';

const NOME_COOKIE = 'agro_admin_session';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly service: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessaoId = await this.service.login(dto);
    response.cookie(NOME_COOKIE, sessaoId, {
      httpOnly: true,
      // secure:true exige HTTPS — em dev local (http://localhost) o
      // navegador descarta silenciosamente um cookie Secure sobre HTTP, o
      // que quebraria o login sem nenhum erro visível. Só exige HTTPS em
      // produção.
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { status: 'ok' };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessaoId = request.cookies?.[NOME_COOKIE] as string | undefined;
    if (sessaoId) await this.service.logout(sessaoId);
    response.clearCookie(NOME_COOKIE);
  }
}
```

- [ ] **Step 9: Serviço e controller de organizações**

Crie `apps/api/src/admin-sistema/admin-organizacoes.service.ts`:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import type { OrganizacaoAdminResponse } from '@agro/contracts';
import { Prisma } from '../generated/prisma/client';
import { hashSenha } from '../common/senha';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOrganizacaoDto } from './admin-sistema.dto';

@Injectable()
export class AdminOrganizacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<OrganizacaoAdminResponse[]> {
    const organizacoes = await this.prisma.organizacao.findMany({
      include: { _count: { select: { usuarios: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return organizacoes.map((o) => ({
      id: o.id,
      nome: o.nome,
      maxUsuarios: o.maxUsuarios,
      totalUsuarios: o._count.usuarios,
      createdAt: o.createdAt.toISOString(),
    }));
  }

  async create(dto: CreateOrganizacaoDto): Promise<OrganizacaoAdminResponse> {
    try {
      const resultado = await this.prisma.$transaction(async (tx) => {
        const organizacao = await tx.organizacao.create({
          data: {
            slug: `org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            nome: dto.nome,
            maxUsuarios: dto.maxUsuarios,
          },
        });
        await tx.usuario.create({
          data: {
            organizacaoId: organizacao.id,
            email: dto.adminEmail,
            senhaHash: await hashSenha(dto.adminSenha),
            papel: 'ORG_ADMIN',
          },
        });
        return organizacao;
      });
      return {
        id: resultado.id,
        nome: resultado.nome,
        maxUsuarios: resultado.maxUsuarios,
        totalUsuarios: 1,
        createdAt: resultado.createdAt.toISOString(),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Já existe um usuário com este email de administrador',
        );
      }
      throw error;
    }
  }
}
```

Crie `apps/api/src/admin-sistema/admin-organizacoes.controller.ts`:

```typescript
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminOrganizacoesService } from './admin-organizacoes.service';
import { CreateOrganizacaoDto } from './admin-sistema.dto';

@ApiTags('admin-organizacoes')
@UseGuards(AdminAuthGuard)
@Controller('admin/organizacoes')
export class AdminOrganizacoesController {
  constructor(private readonly service: AdminOrganizacoesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateOrganizacaoDto) {
    return this.service.create(dto);
  }
}
```

- [ ] **Step 10: Módulo**

Crie `apps/api/src/admin-sistema/admin-sistema.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminOrganizacoesController } from './admin-organizacoes.controller';
import { AdminOrganizacoesService } from './admin-organizacoes.service';

@Module({
  controllers: [AdminAuthController, AdminOrganizacoesController],
  providers: [
    AdminBootstrapService,
    AdminAuthGuard,
    AdminAuthService,
    AdminOrganizacoesService,
  ],
})
export class AdminSistemaModule {}
```

Em `apps/api/src/app.module.ts`, adicione `AdminSistemaModule` ao array `imports`.

- [ ] **Step 11: Variáveis de ambiente de teste**

Em `apps/api/.env.test` e `apps/api/.env.test.example`, adicione duas linhas:

```
ADMIN_BOOTSTRAP_EMAIL=admin-teste@agro.test
ADMIN_BOOTSTRAP_PASSWORD=senha-de-teste-123
```

- [ ] **Step 12: Turbo e CI**

Em `turbo.json`, no array `env` da task `test`, adicione `"ADMIN_BOOTSTRAP_EMAIL"` e
`"ADMIN_BOOTSTRAP_PASSWORD"` (fica `["DATABASE_URL", "CORS_ORIGIN", "PORT", "NODE_ENV", "ADMIN_BOOTSTRAP_EMAIL", "ADMIN_BOOTSTRAP_PASSWORD"]`).

Em `.github/workflows/ci.yml`, no bloco `env:` do job `validate`, adicione as mesmas duas variáveis (com
qualquer valor de teste, ex: `ADMIN_BOOTSTRAP_EMAIL: admin-ci@agro.test` e
`ADMIN_BOOTSTRAP_PASSWORD: senha-ci-teste-123`).

- [ ] **Step 13: Escrever os testes**

Crie `apps/api/test/admin-sistema.test.ts`:

```typescript
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin de sistema', () => {
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

  it('bootstraps exactly one AdminSistema from env vars and never duplicates it', async () => {
    const total = await prisma.adminSistema.count();
    expect(total).toBe(1);
    const admin = await prisma.adminSistema.findUniqueOrThrow({
      where: { email: process.env.ADMIN_BOOTSTRAP_EMAIL },
    });
    expect(admin).toBeTruthy();
  });

  it('logs in with bootstrap credentials and rejects wrong password', async () => {
    await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({
        email: process.env.ADMIN_BOOTSTRAP_EMAIL,
        senha: 'senha-errada',
      })
      .expect(401);

    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({
        email: process.env.ADMIN_BOOTSTRAP_EMAIL,
        senha: process.env.ADMIN_BOOTSTRAP_PASSWORD,
      })
      .expect(200);
    expect(login.headers['set-cookie']?.[0]).toContain('agro_admin_session=');
  });

  it('rejects creating an organization without a valid admin session', async () => {
    await request(app.getHttpServer())
      .post('/admin/organizacoes')
      .send({
        nome: 'Fazenda Teste',
        maxUsuarios: 3,
        adminEmail: 'chefe@fazenda-teste.com',
        adminSenha: 'senha-do-chefe-123',
      })
      .expect(401);
  });

  it('creates an organization with its first ORG_ADMIN user, then lists it', async () => {
    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({
        email: process.env.ADMIN_BOOTSTRAP_EMAIL,
        senha: process.env.ADMIN_BOOTSTRAP_PASSWORD,
      })
      .expect(200);
    const cookie = login.headers['set-cookie'][0] as string;

    const criada = await request(app.getHttpServer())
      .post('/admin/organizacoes')
      .set('Cookie', cookie)
      .send({
        nome: 'Fazenda Teste',
        maxUsuarios: 3,
        adminEmail: 'chefe@fazenda-teste.com',
        adminSenha: 'senha-do-chefe-123',
      })
      .expect(201);
    expect(criada.body).toMatchObject({
      nome: 'Fazenda Teste',
      maxUsuarios: 3,
      totalUsuarios: 1,
    });

    const lista = await request(app.getHttpServer())
      .get('/admin/organizacoes')
      .set('Cookie', cookie)
      .expect(200);
    expect(
      lista.body.find((o: { id: string }) => o.id === criada.body.id),
    ).toMatchObject({ nome: 'Fazenda Teste' });

    await prisma.usuario.deleteMany({
      where: { email: 'chefe@fazenda-teste.com' },
    });
    await prisma.organizacao.delete({ where: { id: criada.body.id } });
  });
});
```

- [ ] **Step 14: Rodar os testes**

Run: `cd apps/api && pnpm test -- admin-sistema.test.ts`
Expected: 4 testes passando.

- [ ] **Step 15: Commit**

```bash
git add apps/api/src/admin-sistema apps/api/src/setup.ts apps/api/src/app.module.ts apps/api/package.json pnpm-lock.yaml apps/api/.env.test apps/api/.env.test.example turbo.json .github/workflows/ci.yml apps/api/test/admin-sistema.test.ts packages/contracts/src/organizacao-admin.ts packages/contracts/src/index.ts
git commit -m "feat(api): adiciona bootstrap de admin de sistema e portal de organizações"
```

---

### Task 4: Login de organização e gestão de usuários

**Files:**

- Create: `apps/api/src/auth/auth-context.ts`
- Create: `apps/api/src/auth/current-user.service.ts`
- Create: `apps/api/src/auth/auth.guard.ts`
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/auth.dto.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/usuarios/usuarios.controller.ts`
- Create: `apps/api/src/usuarios/usuarios.service.ts`
- Create: `apps/api/src/usuarios/usuarios.dto.ts`
- Create: `apps/api/src/usuarios/usuarios.module.ts`
- Create: `packages/contracts/src/usuario.ts`
- Modify: `packages/contracts/src/index.ts`, `apps/api/src/app.module.ts`
- Test: `apps/api/test/auth.test.ts`, `apps/api/test/usuarios.test.ts`

**Interfaces:**

- Consumes: `hashSenha`/`verificarSenha` (Task 2); `POST /admin/auth/login` + `POST /admin/organizacoes`
  (Task 3, usados só nos testes, para criar a organização de teste pelo fluxo real).
- Produces: `AuthContext { usuarioId: string; organizacaoId: string; papel: 'ORG_ADMIN' | 'ORG_MEMBER' }`,
  `CurrentUserService.get(): AuthContext`, `AuthGuard`. Consumidos pela Task 5.

- [ ] **Step 1: Tipo de contexto de autenticação**

Crie `apps/api/src/auth/auth-context.ts`:

```typescript
export interface AuthContext {
  usuarioId: string;
  organizacaoId: string;
  papel: 'ORG_ADMIN' | 'ORG_MEMBER';
}

declare module 'express' {
  interface Request {
    auth?: AuthContext;
  }
}
```

- [ ] **Step 2: CurrentUserService (request-scoped)**

Crie `apps/api/src/auth/current-user.service.ts`:

```typescript
import {
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthContext } from './auth-context';

@Injectable({ scope: Scope.REQUEST })
export class CurrentUserService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  get(): AuthContext {
    if (!this.request.auth) {
      throw new UnauthorizedException('Sessão não autenticada');
    }
    return this.request.auth;
  }
}
```

- [ ] **Step 3: AuthGuard**

Crie `apps/api/src/auth/auth.guard.ts`:

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const SESSAO_DURACAO_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessaoId = request.cookies?.['agro_session'] as string | undefined;
    if (!sessaoId) {
      throw new UnauthorizedException('Sessão não encontrada');
    }

    const sessao = await this.prisma.sessaoUsuario.findFirst({
      where: { id: sessaoId, revogadaEm: null, expiraEm: { gt: new Date() } },
      include: { usuario: true },
    });
    if (!sessao) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }

    await this.prisma.sessaoUsuario.update({
      where: { id: sessao.id },
      data: { expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS) },
    });

    request.auth = {
      usuarioId: sessao.usuario.id,
      organizacaoId: sessao.usuario.organizacaoId,
      papel: sessao.usuario.papel,
    };
    return true;
  }
}
```

- [ ] **Step 4: DTO, serviço e controller de login**

Crie `apps/api/src/auth/auth.dto.ts`:

```typescript
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  senha!: string;
}
```

Crie `apps/api/src/auth/auth.service.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verificarSenha } from '../common/senha';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './auth.dto';

const SESSAO_DURACAO_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto): Promise<string> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    if (!usuario || !(await verificarSenha(dto.senha, usuario.senhaHash))) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }
    const sessao = await this.prisma.sessaoUsuario.create({
      data: {
        usuarioId: usuario.id,
        expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS),
      },
    });
    return sessao.id;
  }

  async logout(sessaoId: string): Promise<void> {
    await this.prisma.sessaoUsuario.updateMany({
      where: { id: sessaoId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }
}
```

Crie `apps/api/src/auth/auth.controller.ts`:

```typescript
import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';

const NOME_COOKIE = 'agro_session';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessaoId = await this.service.login(dto);
    response.cookie(NOME_COOKIE, sessaoId, {
      httpOnly: true,
      // ver nota equivalente em AdminAuthController — Secure só em produção.
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { status: 'ok' };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessaoId = request.cookies?.[NOME_COOKIE] as string | undefined;
    if (sessaoId) await this.service.logout(sessaoId);
    response.clearCookie(NOME_COOKIE);
  }
}
```

Crie `apps/api/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUserService } from './current-user.service';

@Module({
  controllers: [AuthController],
  providers: [AuthGuard, AuthService, CurrentUserService],
  exports: [AuthGuard, CurrentUserService],
})
export class AuthModule {}
```

- [ ] **Step 5: Contrato de resposta de Usuario**

Crie `packages/contracts/src/usuario.ts`:

```typescript
import { z } from 'zod';

export const usuarioResponseSchema = z
  .object({
    id: z.string(),
    email: z.email(),
    papel: z.enum(['ORG_ADMIN', 'ORG_MEMBER']),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type UsuarioResponse = z.infer<typeof usuarioResponseSchema>;
```

Adicione `export * from './usuario';` em `packages/contracts/src/index.ts`.

- [ ] **Step 6: DTO, serviço e controller de usuários**

Crie `apps/api/src/usuarios/usuarios.dto.ts`:

```typescript
import { IsEmail, IsEnum, IsOptional, MinLength } from 'class-validator';
import { PapelUsuario } from '../generated/prisma/client';

export class CreateUsuarioDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  senha!: string;

  @IsOptional()
  @IsEnum(PapelUsuario)
  papel?: PapelUsuario;
}
```

Crie `apps/api/src/usuarios/usuarios.service.ts`:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { UsuarioResponse } from '@agro/contracts';
import { Prisma } from '../generated/prisma/client';
import { CurrentUserService } from '../auth/current-user.service';
import { hashSenha } from '../common/senha';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUsuarioDto } from './usuarios.dto';

type UsuarioRow = {
  id: string;
  email: string;
  papel: 'ORG_ADMIN' | 'ORG_MEMBER';
  createdAt: Date;
};

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
  ) {}

  private toResponse(usuario: UsuarioRow): UsuarioResponse {
    return {
      id: usuario.id,
      email: usuario.email,
      papel: usuario.papel,
      createdAt: usuario.createdAt.toISOString(),
    };
  }

  async list(): Promise<UsuarioResponse[]> {
    const { organizacaoId } = this.currentUser.get();
    const usuarios = await this.prisma.usuario.findMany({
      where: { organizacaoId },
      orderBy: { createdAt: 'asc' },
    });
    return usuarios.map((u) => this.toResponse(u));
  }

  async create(dto: CreateUsuarioDto): Promise<UsuarioResponse> {
    const { organizacaoId, papel } = this.currentUser.get();
    if (papel !== 'ORG_ADMIN') {
      throw new ForbiddenException(
        'Só um usuário administrador da organização pode criar outros usuários',
      );
    }

    const organizacao = await this.prisma.organizacao.findUniqueOrThrow({
      where: { id: organizacaoId },
    });
    const totalAtual = await this.prisma.usuario.count({
      where: { organizacaoId },
    });
    if (totalAtual >= organizacao.maxUsuarios) {
      throw new BadRequestException(
        `Limite de ${organizacao.maxUsuarios} usuários da organização já foi atingido`,
      );
    }

    try {
      const usuario = await this.prisma.usuario.create({
        data: {
          organizacaoId,
          email: dto.email,
          senhaHash: await hashSenha(dto.senha),
          papel: dto.papel ?? 'ORG_MEMBER',
        },
      });
      return this.toResponse(usuario);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Já existe um usuário com este email');
      }
      throw error;
    }
  }
}
```

Crie `apps/api/src/usuarios/usuarios.controller.ts`:

```typescript
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CreateUsuarioDto } from './usuarios.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('usuarios')
@UseGuards(AuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.service.create(dto);
  }
}
```

Crie `apps/api/src/usuarios/usuarios.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [AuthModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
```

Em `apps/api/src/app.module.ts`, adicione `AuthModule` e `UsuariosModule` ao array `imports`.

- [ ] **Step 7: Teste de auth.controller**

Crie `apps/api/test/auth.test.ts`. O helper `criarOrganizacaoDeTeste` abaixo passa pelo fluxo real (login de
admin de sistema → criar organização) para obter um usuário ORG_ADMIN de verdade, sem depender de nenhum
dado pré-existente:

```typescript
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';

async function criarOrganizacaoDeTeste(
  app: INestApplication,
  overrides: { email: string; senha: string },
) {
  const loginAdmin = await request(app.getHttpServer())
    .post('/admin/auth/login')
    .send({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      senha: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    })
    .expect(200);
  const cookieAdmin = loginAdmin.headers['set-cookie'][0] as string;

  const organizacao = await request(app.getHttpServer())
    .post('/admin/organizacoes')
    .set('Cookie', cookieAdmin)
    .send({
      nome: `Org ${Date.now()}`,
      maxUsuarios: 3,
      adminEmail: overrides.email,
      adminSenha: overrides.senha,
    })
    .expect(201);
  return organizacao.body.id as string;
}

describe('Auth de organização', () => {
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

  it('rejects login with wrong credentials', async () => {
    const email = `chefe-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, { email, senha: 'senha-correta-123' });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: 'senha-errada' })
      .expect(401);
  });

  it('logs in, accesses /usuarios, then logs out and loses access', async () => {
    const email = `chefe-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, { email, senha: 'senha-correta-123' });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: 'senha-correta-123' })
      .expect(200);
    const cookie = login.headers['set-cookie'][0] as string;

    await request(app.getHttpServer())
      .get('/usuarios')
      .set('Cookie', cookie)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get('/usuarios')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('rejects requests with no session cookie', async () => {
    await request(app.getHttpServer()).get('/usuarios').expect(401);
  });
});
```

- [ ] **Step 8: Teste de usuarios.controller**

Crie `apps/api/test/usuarios.test.ts` (reaproveita o mesmo helper `criarOrganizacaoDeTeste` — copie a função
de `auth.test.ts` para este arquivo também, já que cada arquivo de teste é independente neste projeto):

```typescript
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

async function criarOrganizacaoDeTeste(
  app: INestApplication,
  overrides: { email: string; senha: string },
) {
  const loginAdmin = await request(app.getHttpServer())
    .post('/admin/auth/login')
    .send({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      senha: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    })
    .expect(200);
  const cookieAdmin = loginAdmin.headers['set-cookie'][0] as string;

  const organizacao = await request(app.getHttpServer())
    .post('/admin/organizacoes')
    .set('Cookie', cookieAdmin)
    .send({
      nome: `Org ${Date.now()}`,
      maxUsuarios: 2,
      adminEmail: overrides.email,
      adminSenha: overrides.senha,
    })
    .expect(201);
  return organizacao.body.id as string;
}

async function logarComo(app: INestApplication, email: string, senha: string) {
  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, senha })
    .expect(200);
  return login.headers['set-cookie'][0] as string;
}

describe('Usuários', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('ORG_ADMIN creates an ORG_MEMBER, which then cannot create more users', async () => {
    const chefeEmail = `chefe-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, {
      email: chefeEmail,
      senha: 'senha-do-chefe-123',
    });
    const cookieChefe = await logarComo(app, chefeEmail, 'senha-do-chefe-123');

    const membroEmail = `membro-${Date.now()}@teste.com`;
    const criado = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', cookieChefe)
      .send({ email: membroEmail, senha: 'senha-do-membro-123' })
      .expect(201);
    expect(criado.body.papel).toBe('ORG_MEMBER');

    const cookieMembro = await logarComo(
      app,
      membroEmail,
      'senha-do-membro-123',
    );
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', cookieMembro)
      .send({ email: `outro-${Date.now()}@teste.com`, senha: 'senha-123456' })
      .expect(403);
  });

  it('rejects creating a user beyond maxUsuarios', async () => {
    const chefeEmail = `chefe-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, {
      email: chefeEmail,
      senha: 'senha-do-chefe-123',
    });
    const cookieChefe = await logarComo(app, chefeEmail, 'senha-do-chefe-123');

    // maxUsuarios é 2: o chefe já conta como 1, então só cabe mais 1.
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', cookieChefe)
      .send({
        email: `membro-${Date.now()}@teste.com`,
        senha: 'senha-123456',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', cookieChefe)
      .send({
        email: `membro-excedente-${Date.now()}@teste.com`,
        senha: 'senha-123456',
      })
      .expect(400);
  });

  it('lists only users from the caller’s own organization', async () => {
    const chefeA = `chefe-a-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, {
      email: chefeA,
      senha: 'senha-chefe-a-123',
    });
    const chefeB = `chefe-b-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, {
      email: chefeB,
      senha: 'senha-chefe-b-123',
    });

    const cookieA = await logarComo(app, chefeA, 'senha-chefe-a-123');
    const lista = await request(app.getHttpServer())
      .get('/usuarios')
      .set('Cookie', cookieA)
      .expect(200);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].email).toBe(chefeA);
  });
});
```

- [ ] **Step 9: Rodar os testes**

Run: `cd apps/api && pnpm test -- auth.test.ts usuarios.test.ts`
Expected: 6 testes passando.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/auth apps/api/src/usuarios apps/api/src/app.module.ts apps/api/test/auth.test.ts apps/api/test/usuarios.test.ts packages/contracts/src/usuario.ts packages/contracts/src/index.ts
git commit -m "feat(api): adiciona login de organização e gestão de usuários"
```

---

### Task 5: Proteger o domínio — AuthGuard global, CurrentOrganizationService e retrofit dos testes existentes

Esta task liga a trava: as 8 rotas do domínio agrícola deixam de ser públicas, e `CurrentOrganizationService`
passa a resolver a organização pela sessão em vez de um slug fixo. Isso quebra TODOS os testes existentes das
8 entidades (fazem requests sem autenticação) — eles são corrigidos na mesma task, porque um guard global sem
os testes corrigidos deixa a suíte vermelha, o que não é um estado entregável.

Nota sobre escopo do NestJS: `CurrentOrganizationService` vira `Scope.REQUEST` porque depende de
`CurrentUserService` (`Scope.REQUEST`). Isso "borbulha" automaticamente para todo serviço de domínio que
injeta `CurrentOrganizationService` (Propriedades, Talhões, Safras, Procedimentos, Insumos, Planejamentos,
Execuções, CompraInsumo) — passam a ser instanciados por requisição em vez de uma vez só. É comportamento
esperado do Nest, não um bug; o custo de performance é irrelevante na escala deste app, então não compense
isso com nenhuma mudança de arquitetura.

**Files:**

- Modify: `apps/api/src/organizacao/current-organization.service.ts`
- Modify: `apps/api/src/organizacao/organizacao.module.ts`
- Modify: `apps/api/src/main.ts` (guard global)
- Modify: `apps/api/src/health.controller.ts` (`@Public()`)
- Modify: `apps/api/src/auth/auth.controller.ts` (`@Public()`)
- Modify: `apps/api/src/admin-sistema/admin-auth.controller.ts` (`@Public()`)
- Modify: `apps/api/src/admin-sistema/admin-organizacoes.controller.ts` (`@Public()`)
- Create: `apps/api/src/auth/public.decorator.ts`
- Create: `apps/api/test/support/autenticar.ts`
- Modify: `apps/api/test/support/fixtures.ts`
- Modify (adicionar cookie em todo `request(...)`): `apps/api/test/propriedades.test.ts`,
  `apps/api/test/talhoes.test.ts`, `apps/api/test/safras.test.ts`, `apps/api/test/procedimentos.test.ts`,
  `apps/api/test/insumos.test.ts`, `apps/api/test/planejamentos.test.ts`, `apps/api/test/execucoes.test.ts`,
  `apps/api/test/compras-insumo.test.ts`, `apps/api/test/integridade-referencial.test.ts`
- Delete: `apps/api/test/organizacao.test.ts` (ver Step 7 — o que ele testava deixou de existir como
  comportamento isolado)

**Interfaces:**

- Consumes: `CurrentUserService` (Task 4).
- Produces: `CurrentOrganizationService.getId()` com a mesma assinatura (`Promise<string>`), agora lendo da
  sessão. `autenticarComoOrgAdmin(prisma): Promise<string>` (helper de teste), usado pela Task 6 também.

- [ ] **Step 1: Decorator `@Public()`**

Crie `apps/api/src/auth/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 2: AuthGuard respeita `@Public()`**

Em `apps/api/src/auth/auth.guard.ts`, injete `Reflector` e pule a checagem em rotas marcadas:

```typescript
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
// ...
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    // ...resto do método sem mudança...
```

- [ ] **Step 3: Marcar como públicas as rotas que não podem exigir sessão de organização**

Uma vez global, o `AuthGuard` passaria a bloquear até as rotas que criam a própria sessão — ninguém tem um
cookie `agro_session` antes de logar. Marque `@Public()` (importado de `../auth/public.decorator`) nestes
controllers, sempre no nível da classe (cobre todos os métodos de uma vez):

- `apps/api/src/health.controller.ts` — health check.
- `apps/api/src/auth/auth.controller.ts` (`AuthController`) — `/auth/login` e `/auth/logout` em si não podem
  exigir a sessão que eles mesmos criam/destroem.
- `apps/api/src/admin-sistema/admin-auth.controller.ts` (`AdminAuthController`) — mesma razão, do lado do
  admin de sistema.
- `apps/api/src/admin-sistema/admin-organizacoes.controller.ts` (`AdminOrganizacoesController`) — essas rotas
  já são protegidas por `@UseGuards(AdminAuthGuard)` (sessão de **admin de sistema**); `@Public()` aqui só as
  isenta do `AuthGuard` de **organização**, que não se aplica a um admin de sistema (ele não tem
  `organizacaoId`). As duas proteções são independentes e `@Public()` não afrouxa a do `AdminAuthGuard`.

Exemplo (`AuthController`):

```typescript
import { Public } from '../auth/public.decorator';
// ...
@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  // ...sem outra mudança...
}
```

Repita o mesmo padrão (import + `@Public()` acima de `@Controller(...)`) nos outros dois controllers listados
acima.

- [ ] **Step 4: Aplicar o AuthGuard globalmente**

Em `apps/api/src/main.ts`, depois de criar a app e antes de `configureApp`, resolva o guard pelo container e
aplique globalmente:

```typescript
import { AuthGuard } from './auth/auth.guard';
// ...
async function bootstrap() {
  const env = readEnv(process.env);
  const app = await NestFactory.create(AppModule);
  app.useGlobalGuards(app.get(AuthGuard));
  configureApp(app, env.CORS_ORIGIN);
  await app.listen(env.PORT, '0.0.0.0');
}
```

(`AuthModule` precisa estar em `imports` de `AppModule` — já está, da Task 4. `AuthGuard` precisa estar em
`exports` de `AuthModule` — já está.)

Com o guard agora global, remova o `@UseGuards(AuthGuard)` que `UsuariosController`
(`apps/api/src/usuarios/usuarios.controller.ts`, Task 4) aplicava no próprio controller — fica redundante
(o guard passa a rodar duas vezes na mesma rota) e sem efeito prático, mas é limpeza que vale fazer agora
para não confundir quem ler o código depois. Mantenha o import de `AuthGuard` removido também, se não for
mais usado nesse arquivo.

**Verificação manual necessária:** depois deste step, rode `cd apps/api && pnpm test -- health` e confirme
que `GET /health` ainda responde 200 sem cookie. O Swagger (`GET /docs`) é montado pelo
`SwaggerModule.setup()` como middleware Express direto, fora do pipeline de guards do Nest — confirme também
rodando a app localmente e acessando `http://localhost:3001/docs` sem cookie; se por algum motivo ele também
passar a exigir sessão, adicione a rota ao `app.use()` do cookie-parser/guard como exceção explícita antes de
seguir.

- [ ] **Step 5: Reescrever `CurrentOrganizationService`**

Substitua todo o conteúdo de `apps/api/src/organizacao/current-organization.service.ts`:

```typescript
import { Injectable, Scope } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service';

@Injectable({ scope: Scope.REQUEST })
export class CurrentOrganizationService {
  constructor(private readonly currentUser: CurrentUserService) {}

  async getId(): Promise<string> {
    return this.currentUser.get().organizacaoId;
  }
}
```

Em `apps/api/src/organizacao/organizacao.module.ts`, importe `AuthModule` (necessário porque
`CurrentOrganizationService` agora depende de `CurrentUserService`):

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CurrentOrganizationService } from './current-organization.service';

@Module({
  imports: [AuthModule],
  providers: [CurrentOrganizationService],
  exports: [CurrentOrganizationService],
})
export class OrganizacaoModule {}
```

- [ ] **Step 6: Helper de teste `autenticarComoOrgAdmin`**

Crie `apps/api/test/support/autenticar.ts`:

```typescript
import type { PrismaService } from '../../src/prisma/prisma.service';
import { hashSenha } from '../../src/common/senha';

const SESSAO_DURACAO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cria um Usuario ORG_ADMIN na organização "default" (recriada por
 * limparBanco() a cada teste) e uma SessaoUsuario válida direto via Prisma
 * — não passa pela rota HTTP de login porque aqui o que está sendo testado
 * é o domínio agrícola, não autenticação em si (essa tem seus próprios
 * testes em auth.test.ts/usuarios.test.ts). Retorna o header Cookie pronto
 * pra usar em `.set('Cookie', cookie)`.
 */
export async function autenticarComoOrgAdmin(
  prisma: PrismaService,
): Promise<string> {
  const organizacao = await prisma.organizacao.findUniqueOrThrow({
    where: { slug: 'default' },
  });
  const usuario = await prisma.usuario.create({
    data: {
      organizacaoId: organizacao.id,
      email: `teste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@agro.test`,
      senhaHash: await hashSenha('senha-de-teste-123'),
      papel: 'ORG_ADMIN',
    },
  });
  const sessao = await prisma.sessaoUsuario.create({
    data: {
      usuarioId: usuario.id,
      expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS),
    },
  });
  return `agro_session=${sessao.id}`;
}
```

- [ ] **Step 7: Apagar `organizacao.test.ts`**

`apps/api/test/organizacao.test.ts` testava `CurrentOrganizationService.getId()` chamando
`module.get(CurrentOrganizationService)` diretamente — isso não funciona mais porque o serviço é
`Scope.REQUEST` agora (só existe dentro de uma requisição HTTP real). O que ele testava (organização ausente,
resolução correta) passa a ser coberto por `auth.test.ts` (sessão ausente → 401) e pelos testes de domínio já
existentes (organização resolvida corretamente a cada chamada autenticada). Apague o arquivo:

Run: `rm apps/api/test/organizacao.test.ts`

- [ ] **Step 8: Retrofit de `fixtures.ts`**

Em `apps/api/test/support/fixtures.ts`, `criarFixturesAgricolas` precisa receber o cookie e usá-lo em toda
chamada. Mude a assinatura e todo `request(app.getHttpServer()).post(...)` dentro da função para encadear
`.set('Cookie', cookie)` antes do `.send(...)`:

```typescript
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

export async function criarFixturesAgricolas(
  app: INestApplication,
  cookie: string,
) {
  const propriedade = await request(app.getHttpServer())
    .post('/propriedades')
    .set('Cookie', cookie)
    .send({ nome: 'Fazenda Esperança', areaHa: 10000 })
    .expect(201);

  const talhao = await request(app.getHttpServer())
    .post(`/propriedades/${propriedade.body.id}/talhoes`)
    .set('Cookie', cookie)
    .send({ nome: 'Talhão 1', areaHa: 2000 })
    .expect(201);

  const safra = await request(app.getHttpServer())
    .post('/safras')
    .set('Cookie', cookie)
    .send({
      nome: 'Colheitas 25/26 Soja',
      cultura: 'Soja',
      dataInicio: '2025-06-01T00:00:00.000Z',
      dataFim: '2030-01-01T00:00:00.000Z',
    })
    .expect(201);

  const procedimento = await request(app.getHttpServer())
    .post('/procedimentos')
    .set('Cookie', cookie)
    .send({ nome: '1ª Aplicação de Fungicida', tipo: 'APLICACAO' })
    .expect(201);

  const procedimentoColheita = await request(app.getHttpServer())
    .post('/procedimentos')
    .set('Cookie', cookie)
    .send({ nome: 'Colheita', tipo: 'COLHEITA' })
    .expect(201);

  const insumo = await request(app.getHttpServer())
    .post('/insumos')
    .set('Cookie', cookie)
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

- [ ] **Step 9: Retrofit de cada arquivo de teste de domínio**

A transformação é idêntica nos 9 arquivos listados abaixo. Para cada um:

1. Adicione o import: `import { autenticarComoOrgAdmin } from './support/autenticar';`
2. Declare `let cookie: string;` junto às outras variáveis do `describe`.
3. No `beforeEach`, depois de `await limparBanco(prisma);`, adicione:
   `cookie = await autenticarComoOrgAdmin(prisma);`
4. Em **todo** `request(app.getHttpServer()).<método>(...)` do arquivo, insira `.set('Cookie', cookie)`
   imediatamente depois da chamada de método HTTP (`.post(...)`, `.get(...)`, `.patch(...)`) e antes de
   `.send(...)`/`.expect(...)`.
5. Em toda chamada a `criarFixturesAgricolas(app)`, passe o cookie: `criarFixturesAgricolas(app, cookie)`.

Arquivos (exatamente estes, nenhum outro arquivo de teste de domínio existe fora desta lista):

- `apps/api/test/propriedades.test.ts`
- `apps/api/test/talhoes.test.ts`
- `apps/api/test/safras.test.ts`
- `apps/api/test/procedimentos.test.ts`
- `apps/api/test/insumos.test.ts`
- `apps/api/test/planejamentos.test.ts`
- `apps/api/test/execucoes.test.ts`
- `apps/api/test/compras-insumo.test.ts`
- `apps/api/test/integridade-referencial.test.ts`

Exemplo completo do padrão aplicado a `apps/api/test/propriedades.test.ts` (use como referência exata para os
outros 8 — a estrutura de `describe`/`beforeAll`/`afterAll` dos outros arquivos já segue este mesmo formato,
só o conteúdo de dentro de cada `it` muda):

```typescript
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './support/limpar-banco';
import { autenticarComoOrgAdmin } from './support/autenticar';

describe('Propriedades', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;

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
    await limparBanco(prisma);
    cookie = await autenticarComoOrgAdmin(prisma);
  });

  it('creates and lists a propriedade', async () => {
    const created = await request(app.getHttpServer())
      .post('/propriedades')
      .set('Cookie', cookie)
      .send({ nome: 'Fazenda Esperança', areaHa: 10000 })
      .expect(201);
    expect(created.body).toMatchObject({ nome: 'Fazenda Esperança' });

    const list = await request(app.getHttpServer())
      .get('/propriedades')
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  // ...todos os outros `it` deste arquivo recebem o mesmo tratamento:
  // .set('Cookie', cookie) em toda chamada request(...).<método>(...).
});
```

- [ ] **Step 10: Rodar a suíte inteira**

Run: `cd apps/api && pnpm test`
Expected: todos os testes passando (o número exato de suites é 10: as 9 retrofitadas + `admin-sistema.test.ts`

- `auth.test.ts` + `usuarios.test.ts` + `senha.test.ts` + `schema-auth.test.ts` + `health.test.ts`, menos
  `organizacao.test.ts` que foi apagado).

Se algum teste falhar com 401 inesperado: confira se o `.set('Cookie', cookie)` foi adicionado em TODA
chamada `request(...)` daquele arquivo, inclusive dentro de helpers locais do próprio arquivo (alguns
arquivos de teste têm helpers internos além de `criarFixturesAgricolas`, ex: `criarContextoParaRegistroVinculado`
em `safras.test.ts` — não deixe de atualizar os helpers internos também).

- [ ] **Step 11: Lint e typecheck**

Run: `cd /home/rafael/projeto_agro/agro && pnpm lint && pnpm typecheck`
Expected: ambos passando.

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/organizacao apps/api/src/auth/public.decorator.ts apps/api/src/auth/auth.guard.ts apps/api/src/auth/auth.controller.ts apps/api/src/admin-sistema/admin-auth.controller.ts apps/api/src/admin-sistema/admin-organizacoes.controller.ts apps/api/src/main.ts apps/api/src/health.controller.ts apps/api/test/support/autenticar.ts apps/api/test/support/fixtures.ts apps/api/test/propriedades.test.ts apps/api/test/talhoes.test.ts apps/api/test/safras.test.ts apps/api/test/procedimentos.test.ts apps/api/test/insumos.test.ts apps/api/test/planejamentos.test.ts apps/api/test/execucoes.test.ts apps/api/test/compras-insumo.test.ts apps/api/test/integridade-referencial.test.ts
git rm apps/api/test/organizacao.test.ts
git commit -m "feat(api): exige sessão em todas as rotas do domínio agrícola"
```

---

### Task 6: Fechar o gap de isolamento entre organizações

**Files:**

- Modify: `apps/api/src/propriedades/propriedades.service.ts`
- Modify: `apps/api/src/talhoes/talhoes.service.ts`
- Modify: `apps/api/src/safras/safras.service.ts`
- Modify: `apps/api/src/procedimentos/procedimentos.service.ts`
- Modify: `apps/api/src/insumos/insumos.service.ts`
- Modify: `apps/api/src/planejamentos/planejamentos.service.ts`
- Modify: `apps/api/src/execucoes/execucoes.service.ts`
- Modify: `apps/api/src/compras-insumo/compras-insumo.service.ts`
- Test: `apps/api/test/isolamento-organizacoes.test.ts`
- Modify: `docs/BACKLOG.md`

**Interfaces:**

- Consumes: `autenticarComoOrgAdmin` (Task 5) — mas este arquivo de teste cria uma SEGUNDA organização
  explicitamente, não usa o helper (ver Step 1).

- [ ] **Step 1: Helper de teste pra uma segunda organização**

Este teste precisa de duas organizações reais — `autenticarComoOrgAdmin` só cria usuários na organização
"default". No topo de `apps/api/test/isolamento-organizacoes.test.ts` (criado neste step), declare um helper
local:

```typescript
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './support/limpar-banco';
import { autenticarComoOrgAdmin } from './support/autenticar';
import { criarFixturesAgricolas } from './support/fixtures';

async function criarOutraOrganizacaoAutenticada(app: INestApplication) {
  const loginAdmin = await request(app.getHttpServer())
    .post('/admin/auth/login')
    .send({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      senha: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    })
    .expect(200);
  const cookieAdmin = loginAdmin.headers['set-cookie'][0] as string;

  const email = `chefe-outra-org-${Date.now()}@teste.com`;
  await request(app.getHttpServer())
    .post('/admin/organizacoes')
    .set('Cookie', cookieAdmin)
    .send({
      nome: `Outra Org ${Date.now()}`,
      maxUsuarios: 2,
      adminEmail: email,
      adminSenha: 'senha-outra-org-123',
    })
    .expect(201);

  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, senha: 'senha-outra-org-123' })
    .expect(200);
  return login.headers['set-cookie'][0] as string;
}

describe('Isolamento entre organizações', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookieOrgA: string;
  let cookieOrgB: string;

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
    await limparBanco(prisma);
    cookieOrgA = await autenticarComoOrgAdmin(prisma);
    cookieOrgB = await criarOutraOrganizacaoAutenticada(app);
  });

  it('returns 404 reading a Propriedade from another organization by id', async () => {
    const propriedade = await request(app.getHttpServer())
      .post('/propriedades')
      .set('Cookie', cookieOrgA)
      .send({ nome: 'Fazenda da Org A', areaHa: 500 })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/propriedades/${propriedade.body.id}`)
      .set('Cookie', cookieOrgB)
      .expect(404);
  });

  it('returns 404 updating a Safra from another organization by id', async () => {
    const safra = await request(app.getHttpServer())
      .post('/safras')
      .set('Cookie', cookieOrgA)
      .send({
        nome: 'Safra da Org A',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/safras/${safra.body.id}`)
      .set('Cookie', cookieOrgB)
      .send({
        nome: 'Tentativa de editar',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(404);
  });

  it('returns 404 reading a Talhao from another organization by id (via relação com Propriedade)', async () => {
    const { talhao } = await criarFixturesAgricolas(app, cookieOrgA);

    await request(app.getHttpServer())
      .get(`/talhoes/${talhao.id}`)
      .set('Cookie', cookieOrgB)
      .expect(404);
  });

  it('returns 404 creating a Planejamento that references a Talhao from another organization', async () => {
    const { talhao, procedimento, insumo } = await criarFixturesAgricolas(
      app,
      cookieOrgA,
    );
    const { safra: safraOrgB } = await criarFixturesAgricolas(app, cookieOrgB);

    await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookieOrgB)
      .send({
        safraId: safraOrgB.id,
        talhaoId: talhao.id, // pertence à Org A
        procedimentoId: procedimento.id, // pertence à Org A
        dataPrevista: new Date(Date.now() + 86400000).toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }], // pertence à Org A
      })
      .expect(404);
  });

  it('returns 404 creating a CompraInsumo that references a Safra from another organization', async () => {
    const { talhao: talhaoOrgB, insumo: insumoOrgB } =
      await criarFixturesAgricolas(app, cookieOrgB);
    const { safra: safraOrgA } = await criarFixturesAgricolas(app, cookieOrgA);

    await request(app.getHttpServer())
      .post('/compras-insumo')
      .set('Cookie', cookieOrgB)
      .send({
        talhaoId: talhaoOrgB.id,
        safraId: safraOrgA.id, // pertence à Org A
        insumoId: insumoOrgB.id,
        data: new Date().toISOString(),
        quantidade: 10,
      })
      .expect(404);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd apps/api && pnpm test -- isolamento-organizacoes.test.ts`
Expected: FAIL — hoje todas essas chamadas retornam 200/201 em vez de 404, porque nenhum lookup filtra por
organização.

- [ ] **Step 3: Corrigir `propriedades.service.ts`**

Em `apps/api/src/propriedades/propriedades.service.ts`, `getOrThrow` passa a receber `organizacaoId`:

```typescript
  async getOrThrow(id: string): Promise<PropriedadeRow> {
    const organizacaoId = await this.currentOrg.getId();
    const propriedade = await this.prisma.propriedade.findFirst({
      where: { id, organizacaoId },
    });
    if (!propriedade) throw new NotFoundException('Propriedade não encontrada');
    return propriedade;
  }
```

- [ ] **Step 4: Corrigir `safras.service.ts`, `procedimentos.service.ts`, `insumos.service.ts`**

Mesmo padrão do Step 3 — nos três arquivos, `getOrThrow` passa a injetar `CurrentOrganizationService` (se
ainda não injetado) e trocar `findUnique({ where: { id } })` por
`findFirst({ where: { id, organizacaoId } })`, com `organizacaoId = await this.currentOrg.getId()` obtido
antes da consulta. `procedimentos.service.ts` hoje não tem `update()` — não precisa adicionar um; só corrija
`getOrThrow`.

- [ ] **Step 5: Corrigir `talhoes.service.ts` (caso especial — via relação)**

`Talhao` não tem `organizacaoId` próprio. Em `apps/api/src/talhoes/talhoes.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import type { TalhaoResponse } from '@agro/contracts';
import { Prisma } from '../generated/prisma/client';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTalhaoDto, UpdateTalhaoDto } from './talhoes.dto';

// ...TalhaoRow sem mudança...

@Injectable()
export class TalhoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  // ...toResponse sem mudança...

  private async getPropriedadeOrThrow(propriedadeId: string) {
    const organizacaoId = await this.currentOrg.getId();
    const propriedade = await this.prisma.propriedade.findFirst({
      where: { id: propriedadeId, organizacaoId },
    });
    if (!propriedade) throw new NotFoundException('Propriedade não encontrada');
    return propriedade;
  }

  // ...list/create sem mudança (já ficam seguros porque getPropriedadeOrThrow agora é escopado)...

  async getOrThrow(id: string): Promise<TalhaoRow> {
    const organizacaoId = await this.currentOrg.getId();
    const talhao = await this.prisma.talhao.findFirst({
      where: { id, propriedade: { organizacaoId } },
    });
    if (!talhao) throw new NotFoundException('Talhão não encontrado');
    return talhao;
  }

  // ...getById/update sem mudança (já chamam getOrThrow)...
}
```

`TalhoesService` hoje não injeta `CurrentOrganizationService` (é o único serviço de domínio que não
precisava — confirme olhando o arquivo atual antes de editar). `apps/api/src/talhoes/talhoes.module.ts`
também não importa `OrganizacaoModule` ainda. Adicione os dois:

```typescript
import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { TalhoesController } from './talhoes.controller';
import { TalhoesService } from './talhoes.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [TalhoesController],
  providers: [TalhoesService],
  exports: [TalhoesService],
})
export class TalhoesModule {}
```

- [ ] **Step 6: Corrigir `planejamentos.service.ts`**

Em `apps/api/src/planejamentos/planejamentos.service.ts`, `create()` troca as 3 consultas de existência de
FK:

```typescript
const organizacaoId = await this.currentOrg.getId();
const [safra, talhao, procedimento] = await Promise.all([
  this.prisma.safra.findFirst({ where: { id: dto.safraId, organizacaoId } }),
  this.prisma.talhao.findFirst({
    where: { id: dto.talhaoId, propriedade: { organizacaoId } },
  }),
  this.prisma.procedimento.findFirst({
    where: { id: dto.procedimentoId, organizacaoId },
  }),
]);
```

e a validação em lote de insumos:

```typescript
const insumoIds = dto.insumos.map((i) => i.insumoId);
const insumos = await this.prisma.insumo.findMany({
  where: { id: { in: insumoIds }, organizacaoId },
});
```

e `getOrThrow`:

```typescript
  async getOrThrow(id: string): Promise<PlanejamentoRow> {
    const organizacaoId = await this.currentOrg.getId();
    const item = await this.prisma.planejamentoItem.findFirst({
      where: { id, organizacaoId },
      include: { insumos: true },
    });
    if (!item) throw new NotFoundException('Planejamento não encontrado');
    return item;
  }
```

(ajuste o `include`/formato exato conforme o que já existe hoje nesse método — só adicione `organizacaoId`
ao `where` e troque `findUnique` por `findFirst`, mantendo o resto igual.)

- [ ] **Step 7: Corrigir `execucoes.service.ts`**

Mesmo padrão do Step 6: `safra`/`procedimento` ganham `organizacaoId` no `where` (`findFirst` em vez de
`findUnique`), `talhao` ganha `propriedade: { organizacaoId }`, a checagem opcional de `planejamentoItemId`
ganha `organizacaoId` no `where`, e a validação em lote de insumos ganha `organizacaoId`.

- [ ] **Step 8: Corrigir `compras-insumo.service.ts`**

Mesmo padrão: `talhao` ganha `propriedade: { organizacaoId }`, `safra` e `insumo` ganham `organizacaoId` no
`where`, todos trocando `findUnique` por `findFirst`.

- [ ] **Step 9: Rodar os testes de isolamento**

Run: `cd apps/api && pnpm test -- isolamento-organizacoes.test.ts`
Expected: 5 testes passando.

- [ ] **Step 10: Rodar a suíte inteira**

Run: `cd apps/api && pnpm test`
Expected: tudo passando (nenhum teste da Task 5 deveria ter sido afetado — eles usam só a organização
"default", nunca cruzam organizações).

- [ ] **Step 11: Atualizar `docs/BACKLOG.md`**

No item #3 de `docs/BACKLOG.md`, troque o status de 🟡 Parcialmente resolvido para ✅ Resolvido, e no texto do
sub-caso que estava bloqueado (isolamento entre organizações), explique que agora existe uma segunda
organização de verdade (via `/admin/organizacoes`) e que `apps/api/test/isolamento-organizacoes.test.ts`
prova o isolamento nas 8 entidades, incluindo o caso especial de Talhão.

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/propriedades/propriedades.service.ts apps/api/src/talhoes apps/api/src/safras/safras.service.ts apps/api/src/procedimentos/procedimentos.service.ts apps/api/src/insumos/insumos.service.ts apps/api/src/planejamentos/planejamentos.service.ts apps/api/src/execucoes/execucoes.service.ts apps/api/src/compras-insumo/compras-insumo.service.ts apps/api/test/isolamento-organizacoes.test.ts docs/BACKLOG.md
git commit -m "fix(api): fecha o isolamento entre organizações em todo lookup por id"
```

---

### Task 7: Rate limiting nos logins

**Files:**

- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/admin-sistema/admin-auth.controller.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/package.json`
- Test: `apps/api/test/rate-limit-login.test.ts`

**Interfaces:**

- Consumes: rotas de login das Tasks 3 e 4.

- [ ] **Step 1: Instalar**

Run: `cd apps/api && pnpm add @nestjs/throttler`

- [ ] **Step 2: Registrar o módulo globalmente**

Em `apps/api/src/app.module.ts`:

```typescript
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
// ...
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 5 }],
    }),
    // ...módulos existentes sem mudança...
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

(este `APP_GUARD` é separado do `AuthGuard` aplicado em `main.ts` via `useGlobalGuards` — os dois rodam
juntos, sem conflito; o Throttler protege contra volume, o Auth contra sessão ausente.)

- [ ] **Step 3: Rodar a suíte pra confirmar que nada quebrou**

Run: `cd apps/api && pnpm test`
Expected: tudo passando (o limite de 5/minuto não deveria ser atingido por nenhum teste existente, que faz
poucas chamadas de login por arquivo).

- [ ] **Step 4: Escrever o teste do limite**

Crie `apps/api/test/rate-limit-login.test.ts`:

```typescript
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

describe('Rate limit no login', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks the 6th login attempt within a minute from the same client', async () => {
    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'inexistente@teste.com', senha: 'qualquer' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'inexistente@teste.com', senha: 'qualquer' })
      .expect(429);
  });
});
```

- [ ] **Step 5: Rodar e confirmar**

Run: `cd apps/api && pnpm test -- rate-limit-login.test.ts`
Expected: 1 teste passando.

- [ ] **Step 6: Rodar a suíte inteira de novo**

Run: `cd apps/api && pnpm test`
Expected: tudo passando. Se algum outro arquivo passar a falhar com 429 (porque agora faz mais de 5 logins
por minuto no mesmo processo jest), isso é esperado só se um arquivo de teste futuro fizer muitos logins
seguidos — não deveria ser o caso de nenhum arquivo já escrito nas Tasks 3-6, que fazem no máximo 2-3 logins
por `it`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/package.json pnpm-lock.yaml apps/api/test/rate-limit-login.test.ts
git commit -m "feat(api): adiciona rate limit nos endpoints de login"
```

---

### Task 8: Telas de login (apps/web)

**Files:**

- Create: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/lib/admin.ts`
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/app/admin/login/page.tsx`
- Test: `apps/web/src/lib/auth.test.ts`, `apps/web/src/lib/admin.test.ts`

**Interfaces:**

- Produces: `login(baseUrl, credenciais): Promise<void>`, `loginAdmin(baseUrl, credenciais): Promise<void>` —
  usados pelas telas desta task e pela Task 9.

- [ ] **Step 1: Checar o padrão de teste existente no app web**

Leia `apps/web/src/lib/health.test.ts` (se existir) ou `apps/web/src/components/*.test.tsx` pra confirmar o
runner (`vitest`) e o estilo de mock de `fetch` já usado no projeto antes de escrever os testes abaixo — siga
o mesmo padrão de mock.

- [ ] **Step 2: `lib/auth.ts`**

Crie `apps/web/src/lib/auth.ts`:

```typescript
import { httpUrlSchema } from '@agro/validation';

export async function login(
  baseUrl: string | undefined,
  credenciais: { email: string; senha: string },
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/auth/login', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credenciais),
  });
  if (!response.ok) throw new Error('Email ou senha inválidos');
}
```

- [ ] **Step 3: `lib/admin.ts`**

Crie `apps/web/src/lib/admin.ts`:

```typescript
import { httpUrlSchema } from '@agro/validation';

export async function loginAdmin(
  baseUrl: string | undefined,
  credenciais: { email: string; senha: string },
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/admin/auth/login', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credenciais),
  });
  if (!response.ok) throw new Error('Email ou senha inválidos');
}
```

- [ ] **Step 4: Testes dos helpers**

Crie `apps/web/src/lib/auth.test.ts` (e o equivalente `admin.test.ts` trocando só a rota e o import):

```typescript
import { describe, expect, it, vi } from 'vitest';
import { login } from './auth';

describe('login', () => {
  it('posts credentials with credentials:"include" and resolves on success', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await login(
      'http://localhost:3001',
      { email: 'a@a.com', senha: 'senha123' },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/auth/login'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
  });

  it('throws on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false });
    await expect(
      login(
        'http://localhost:3001',
        { email: 'a@a.com', senha: 'errada' },
        fetcher,
      ),
    ).rejects.toThrow('Email ou senha inválidos');
  });
});
```

- [ ] **Step 5: Rodar os testes**

Run: `cd apps/web && pnpm test`
Expected: os novos testes passando junto com os já existentes.

- [ ] **Step 6: Tela `/login`**

Crie `apps/web/src/app/login/page.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@agro/ui/button';
import { login } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function aoEnviar(event: React.FormEvent) {
    event.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      await login(process.env.NEXT_PUBLIC_API_URL, { email, senha });
      router.push('/usuarios');
    } catch {
      setErro('Email ou senha inválidos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <form onSubmit={aoEnviar} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Senha</span>
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2"
          />
        </label>
        {erro && (
          <p role="alert" className="text-sm text-red-600">
            {erro}
          </p>
        )}
        <Button type="submit" disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <a href="/admin/login" className="text-sm text-muted-foreground">
        Acesso administrativo
      </a>
    </main>
  );
}
```

- [ ] **Step 7: Tela `/admin/login`**

Crie `apps/web/src/app/admin/login/page.tsx` com a mesma estrutura do Step 6, importando `loginAdmin` de
`@/lib/admin` em vez de `login`, redirecionando para `/admin/organizacoes` em vez de `/usuarios`, e sem o link
de "Acesso administrativo" no final (trocar por um link `href="/login"` com o texto "Voltar para o login").

- [ ] **Step 8: Rodar o typecheck e o build do web**

Run: `cd /home/rafael/projeto_agro/agro && pnpm --filter @agro/web typecheck && pnpm --filter @agro/web build`
Expected: ambos passando.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/auth.ts apps/web/src/lib/admin.ts apps/web/src/lib/auth.test.ts apps/web/src/lib/admin.test.ts apps/web/src/app/login apps/web/src/app/admin/login
git commit -m "feat(web): adiciona telas de login de organização e de admin de sistema"
```

---

### Task 9: Telas de gestão (apps/web)

**Files:**

- Create: `apps/web/src/lib/usuarios.ts`
- Create: `apps/web/src/lib/organizacoes.ts`
- Create: `apps/web/src/app/usuarios/page.tsx`
- Create: `apps/web/src/app/admin/organizacoes/page.tsx`
- Test: `apps/web/src/lib/usuarios.test.ts`, `apps/web/src/lib/organizacoes.test.ts`

**Interfaces:**

- Consumes: `GET+POST /usuarios` (Task 4), `GET+POST /admin/organizacoes` (Task 3).

- [ ] **Step 1: `lib/usuarios.ts`**

Crie `apps/web/src/lib/usuarios.ts`:

```typescript
import { httpUrlSchema } from '@agro/validation';
import { usuarioResponseSchema, type UsuarioResponse } from '@agro/contracts';
import { z } from 'zod';

export async function listarUsuarios(
  baseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<UsuarioResponse[]> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/usuarios', url), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível listar usuários');
  return z.array(usuarioResponseSchema).parse(await response.json());
}

export async function criarUsuario(
  baseUrl: string | undefined,
  dados: { email: string; senha: string },
  fetcher: typeof fetch = fetch,
): Promise<UsuarioResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/usuarios', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível criar o usuário');
  }
  return usuarioResponseSchema.parse(await response.json());
}
```

- [ ] **Step 2: `lib/organizacoes.ts`**

Crie `apps/web/src/lib/organizacoes.ts`, mesmo padrão do Step 1, chamando `/admin/organizacoes` e usando
`organizacaoAdminResponseSchema`/`OrganizacaoAdminResponse` de `@agro/contracts`, com `criarOrganizacao`
recebendo `{ nome: string; maxUsuarios: number; adminEmail: string; adminSenha: string }`.

- [ ] **Step 3: Testes dos helpers**

Crie `apps/web/src/lib/usuarios.test.ts` e `apps/web/src/lib/organizacoes.test.ts`, seguindo exatamente o
padrão de mock de `fetch` usado em `apps/web/src/lib/auth.test.ts` (Task 8) — um teste de listagem com
sucesso, um de criação com sucesso, um de criação com erro (resposta não-ok) propagando a mensagem do corpo.

- [ ] **Step 4: Rodar os testes**

Run: `cd apps/web && pnpm test`
Expected: tudo passando.

- [ ] **Step 5: Tela `/usuarios`**

Crie `apps/web/src/app/usuarios/page.tsx`: componente cliente que, ao montar, chama `listarUsuarios` e
mostra uma lista (email + papel); abaixo, um formulário com email/senha que chama `criarUsuario` e, no
sucesso, recarrega a lista. Em caso de erro (403 quando quem está logado é `ORG_MEMBER`, ou 400 de limite de
vagas), mostra a mensagem de erro retornada pelo helper. Siga o mesmo padrão estrutural de
`apps/web/src/app/login/page.tsx` (estado local com `useState`, Tailwind, `Button` de `@agro/ui/button`).

- [ ] **Step 6: Tela `/admin/organizacoes`**

Crie `apps/web/src/app/admin/organizacoes/page.tsx`: mesmo padrão do Step 5, listando organizações (nome,
`maxUsuarios`, `totalUsuarios`) e com um formulário de criação (nome, maxUsuarios, adminEmail, adminSenha)
chamando `criarOrganizacao`.

- [ ] **Step 7: Rodar o typecheck e o build do web**

Run: `cd /home/rafael/projeto_agro/agro && pnpm --filter @agro/web typecheck && pnpm --filter @agro/web build`
Expected: ambos passando.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/usuarios.ts apps/web/src/lib/organizacoes.ts apps/web/src/lib/usuarios.test.ts apps/web/src/lib/organizacoes.test.ts apps/web/src/app/usuarios apps/web/src/app/admin/organizacoes
git commit -m "feat(web): adiciona telas de gestão de usuários e de organizações"
```

---

### Task 10: Documentação

**Files:**

- Modify: `docs/AUTH.md`, `docs/DOMAIN.md`, `docs/FLUXOS.md`, `docs/DATABASE.md`, `README.md`

**Interfaces:**

- Consumes: resultado final de todas as tasks anteriores (esta task só documenta o que já foi implementado e
  verificado).

- [ ] **Step 1: Reescrever `docs/AUTH.md`**

Substitua o conteúdo (que hoje diz "não implementadas nesta fase" e tem a afirmação incorreta sobre todo
lookup já ser filtrado por organizacaoId) por uma descrição factual do que existe: os dois mundos de sessão
(admin de sistema vs. usuário de organização), os cookies (`agro_admin_session`, `agro_session`), onde o
bootstrap do admin de sistema é configurado (`ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD`), e que todo
lookup por id agora é escopado por organização (ver `apps/api/src/talhoes/talhoes.service.ts` para o caso
especial de Talhão).

- [ ] **Step 2: Nota em `docs/DOMAIN.md`**

Adicione um parágrafo esclarecendo que `Usuario`/`AdminSistema`/`SessaoUsuario`/`SessaoAdminSistema` são
identidade e acesso, não fazem parte do domínio de Gestão Agrícola em si (que continua sendo as 8 entidades
já documentadas).

- [ ] **Step 3: Atualizar `docs/FLUXOS.md`**

Remova a nota de status ("ainda não implementado") do topo do arquivo — os diagramas passam a refletir o
sistema real. Releia cada diagrama contra o que foi implementado (nomes de rota, nomes de cookie) e corrija
qualquer divergência.

- [ ] **Step 4: Nota em `docs/DATABASE.md`**

Adicione uma seção curta sobre as 4 tabelas novas (`AdminSistema`, `SessaoAdminSistema`, `Usuario`,
`SessaoUsuario`) e o campo `Organizacao.maxUsuarios`.

- [ ] **Step 5: `README.md`**

Na seção de variáveis de ambiente/quickstart, adicione `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD`
como variáveis obrigatórias no primeiro boot, com uma frase explicando que são lidas uma única vez (se já
existir um admin de sistema, são ignoradas).

- [ ] **Step 6: Commit**

```bash
git add docs/AUTH.md docs/DOMAIN.md docs/FLUXOS.md docs/DATABASE.md README.md
git commit -m "docs: documenta autenticação e multiempresa implementadas"
```

---

## Self-review

**Cobertura da spec:** bootstrap do admin de sistema (Task 3), login/logout dos dois mundos (Tasks 3-4),
`AdminAuthGuard`/`AuthGuard` (Tasks 3-5), `CurrentOrganizationService` por sessão (Task 5), rotas novas
(Tasks 3-4), fechamento do gap de isolamento incluindo o caso Talhão (Task 6), rate limiting (Task 7), CORS
`credentials: true` (Task 3), telas de frontend (Tasks 8-9), `docs/FLUXOS.md` como documento vivo (já criado
no brainstorm, atualizado na Task 10), dados existentes preservados sem senha gerada por migration (Task 1 só
adiciona colunas/tabelas, não popula `Usuario`). Item fora de escopo da spec (self-signup, forgot-password,
OAuth, papéis granulares, telas de domínio) — nenhuma task os implementa, como pretendido.

**Placeholders:** nenhum "TBD"/"similar a" — a Task 5 lista exaustivamente os 9 arquivos a retrofitar e dá o
padrão exato de transformação com um exemplo completo, em vez de dizer "faça o mesmo nos outros".

**Consistência de tipos:** `AuthContext` (Task 4) é consumido com os mesmos 3 campos em `CurrentUserService`
(Task 4) e `CurrentOrganizationService` (Task 5). `autenticarComoOrgAdmin` (Task 5) é usado com a mesma
assinatura na Task 6. Nomes de cookie (`agro_session`, `agro_admin_session`) são consistentes entre guard,
controller e testes em todas as tasks que os tocam.

## Execução

Plano completo e salvo em `docs/superpowers/plans/2026-10-14-autenticacao-multiempresa.md`. Duas opções de execução:

**1. Subagent-driven (recomendado)** — eu disparo um subagente novo por task, revisão entre tasks, iteração rápida.

**2. Execução inline** — executo as tasks nesta sessão via executing-plans, em lotes com checkpoints de revisão.

Qual abordagem?
