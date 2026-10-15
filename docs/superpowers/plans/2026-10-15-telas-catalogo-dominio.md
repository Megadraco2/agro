# Telas de Catálogo do Domínio Agrícola Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao AGRO as primeiras telas reais de domínio agrícola — sistema de design (cores/tipografia/componentes compartilhados) e CRUD completo de Propriedades, Procedimentos e Insumos no frontend (`apps/web`), consumindo a API REST já pronta e testada.

**Architecture:** Estende os tokens Tailwind v4 já existentes em `apps/web/src/app/globals.css` com a cor de destaque dourada e a tipografia Archivo/IBM Plex Mono. Adiciona 4 primitivas de UI em `packages/ui/src` (Table, Modal, Input/Select, Pill) seguindo o padrão CVA+`cn()` já usado pelo `Button`. Cria uma camada `lib/` por entidade em `apps/web/src/lib` (função pura, fetcher injetável, `httpUrlSchema`, parse com Zod de `@agro/contracts`) idêntica ao padrão de `usuarios.ts`. As 3 telas vivem num route group `(dominio)` com um layout de barra lateral fixa compartilhado.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Radix UI (`@radix-ui/react-dialog`, novo), `class-variance-authority`, `clsx`+`tailwind-merge`, Zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-telas-catalogo-dominio-design.md`

## Global Constraints

- Cores: `--primary: #176442` (já existe, mantido), `--accent: #e8b65a` (novo, dourado de trigo), `--accent-foreground: #15392b` (reaproveita o `--foreground` verde para contraste sobre o dourado), `--background: #fdfbf6` (atualizado do `#f7faf8` atual), `--muted-foreground: #5b7869` (novo — hoje `text-muted-foreground` é usado em `/usuarios` e `/admin/organizacoes` sem token correspondente, então a classe não gera CSS nenhum; esta tarefa corrige isso de passagem).
- Tipografia: Archivo (`--font-sans`, títulos e corpo) e IBM Plex Mono (`--font-mono`, só para números tabulares), ambas via `next/font/google`.
- Arquitetura de componentes: componentes próprios por entidade (`PropriedadesPage`, etc.) compostos de primitivas compartilhadas em `@agro/ui` (`Table`, `Modal`, `Input`, `Select`, `Pill`) — nunca uma abstração genérica tipo `<EntityTable config={...}>`.
- Navegação: barra lateral fixa com as 8 áreas do domínio — 3 ativas (Propriedades, Procedimentos, Insumos) e 5 futuras marcadas com `Pill` "Em breve" (Talhões, Safras, Planejamento, Execução, Compra de Insumo).
- Formulário: modal (Radix Dialog) para criar/editar, mantendo a lista visível por trás.
- Erros do backend sempre exibidos com a mensagem real do corpo da resposta (`corpo.message`), nunca uma mensagem genérica quando o backend fornece uma.
- `lib/`: função pura, fetcher injetável com default `fetch`, `credentials: 'include'`, valida a URL base com `httpUrlSchema` de `@agro/validation`, faz parse da resposta com o schema Zod de `@agro/contracts`.
- Sem testes de renderização de componentes — padrão já estabelecido no projeto (o `Button` existente não tem teste). Testes só na camada `lib/`.
- Sem paginação (backend não pagina) e sem distinção de papel `ORG_ADMIN`/`ORG_MEMBER` nas ações de editar/apagar (já decidido no backend).
- AGENTS.md: use pnpm, Conventional Commits, e garanta que lint/typecheck/test/build passem antes de considerar qualquer tarefa concluída.

---

### Task 1: Tokens de design e tipografia

**Files:**

- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**

- Produces: as classes utilitárias Tailwind `bg-accent`, `text-accent-foreground`, `text-muted-foreground`, `font-sans`, `font-mono`, consumidas pelas Tasks 3, 7, 8, 9, 10.

- [ ] **Step 1: Atualizar os tokens de cor em `globals.css`**

```css
@import 'tailwindcss';
@source "../../../../packages/ui/src";
:root {
  --background: #fdfbf6;
  --foreground: #15392b;
  --primary: #176442;
  --primary-foreground: #ffffff;
  --accent: #e8b65a;
  --accent-foreground: #15392b;
  --muted-foreground: #5b7869;
  --border: #ceddd4;
}
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 2: Carregar Archivo e IBM Plex Mono em `layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { PwaRegister } from '@/components/pwa-register';

const archivo = Archivo({ subsets: ['latin'], variable: '--font-sans' });
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Agro',
  description: 'Fundação da plataforma de gestão agrícola',
  appleWebApp: { capable: true, title: 'Agro', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#176442',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verificar**

Não há comportamento testável por unidade aqui (é configuração de CSS/fonte) — a verificação é o build do app, que falha se as fontes ou os tokens estiverem mal formados:

Run: `pnpm --filter @agro/web typecheck && pnpm --filter @agro/web build`
Expected: ambos passam sem erro.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/layout.tsx
git commit -m "feat(web): add accent/muted tokens and Archivo/IBM Plex Mono fonts"
```

---

### Task 2: Componente `Modal` compartilhado

**Files:**

- Modify: `packages/ui/package.json`
- Create: `packages/ui/src/modal.tsx`

**Interfaces:**

- Consumes: `cn` de `./utils` (já existe).
- Produces: `Modal({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode })`, exportado em `@agro/ui/modal`. Consumido pelas Tasks 8, 9, 10.

- [ ] **Step 1: Adicionar a dependência do Radix Dialog**

Run: `pnpm --filter @agro/ui add @radix-ui/react-dialog`

Expected: `packages/ui/package.json` passa a listar `@radix-ui/react-dialog` em `dependencies`, com a versão resolvida pelo pnpm (não escreva a versão manualmente).

- [ ] **Step 2: Criar `packages/ui/src/modal.tsx`**

```tsx
'use client';
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from './utils';

export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-foreground/40" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-border bg-white p-6 shadow-lg',
          )}
        >
          <Dialog.Title className="mb-4 text-lg font-semibold">
            {title}
          </Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 3: Adicionar o export em `packages/ui/package.json`**

No campo `"exports"`, adicione a entrada `"./modal": "./src/modal.tsx"` ao lado de `"./button"` e `"./utils"` já existentes.

- [ ] **Step 4: Verificar**

Sem teste de renderização (mesmo padrão do `Button`, que também não tem teste).

Run: `pnpm --filter @agro/ui typecheck`
Expected: passa sem erro.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/package.json packages/ui/src/modal.tsx pnpm-lock.yaml
git commit -m "feat(ui): add Modal component wrapping Radix Dialog"
```

---

### Task 3: Componentes `Table`, `Input`/`Select` e `Pill`

**Files:**

- Create: `packages/ui/src/table.tsx`
- Create: `packages/ui/src/input.tsx`
- Create: `packages/ui/src/pill.tsx`
- Modify: `packages/ui/package.json`

**Interfaces:**

- Consumes: `cn` de `./utils`; tokens `bg-accent`, `text-accent-foreground`, `text-muted-foreground`, `font-mono` da Task 1.
- Produces:
  - `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` (esta última com prop `numeric?: boolean`) em `@agro/ui/table`.
  - `Input({ label, error, ...props }: React.ComponentProps<'input'> & { label: string; error?: string })` e `Select({ label, error, options, ...props }: Omit<React.ComponentProps<'select'>, 'children'> & { label: string; error?: string; options: { value: string; label: string }[] })` em `@agro/ui/input`.
  - `Pill({ variant, ...props }: React.ComponentProps<'span'> & { variant?: 'default' | 'muted' })` em `@agro/ui/pill`.
  - Consumidos pelas Tasks 7, 8, 9, 10.

- [ ] **Step 1: Criar `packages/ui/src/table.tsx`**

```tsx
import * as React from 'react';
import { cn } from './utils';

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border">
      <table
        className={cn('w-full border-collapse text-sm', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.ComponentProps<'thead'>) {
  return <thead className={cn('bg-background', className)} {...props} />;
}

export function TableBody({
  className,
  ...props
}: React.ComponentProps<'tbody'>) {
  return <tbody className={className} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn('border-b border-border last:border-0', className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  numeric = false,
  ...props
}: React.ComponentProps<'td'> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'px-4 py-3',
        numeric && 'text-right font-mono tabular-nums',
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Criar `packages/ui/src/input.tsx`**

```tsx
import * as React from 'react';
import { cn } from './utils';

type InputProps = React.ComponentProps<'input'> & {
  label: string;
  error?: string;
};

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        className={cn(
          'w-full rounded-lg border border-border px-3 py-2 text-sm',
          error && 'border-red-500',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && (
        <span role="alert" className="block text-sm text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

type SelectOption = { value: string; label: string };

type SelectProps = Omit<React.ComponentProps<'select'>, 'children'> & {
  label: string;
  error?: string;
  options: SelectOption[];
};

export function Select({
  label,
  error,
  options,
  className,
  ...props
}: SelectProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <select
        className={cn(
          'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm',
          error && 'border-red-500',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="block text-sm text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
```

- [ ] **Step 3: Criar `packages/ui/src/pill.tsx`**

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const pillVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-foreground',
        muted: 'bg-border text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Pill({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof pillVariants>) {
  return (
    <span className={cn(pillVariants({ variant, className }))} {...props} />
  );
}
```

- [ ] **Step 4: Adicionar os exports em `packages/ui/package.json`**

No campo `"exports"`, adicione `"./table": "./src/table.tsx"`, `"./input": "./src/input.tsx"` e `"./pill": "./src/pill.tsx"`.

- [ ] **Step 5: Verificar**

Sem teste de renderização (mesmo padrão do `Button`).

Run: `pnpm --filter @agro/ui typecheck`
Expected: passa sem erro.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/package.json packages/ui/src/table.tsx packages/ui/src/input.tsx packages/ui/src/pill.tsx
git commit -m "feat(ui): add Table, Input, Select and Pill components"
```

---

### Task 4: `lib/propriedades.ts`

**Files:**

- Create: `apps/web/src/lib/propriedades.ts`
- Test: `apps/web/src/lib/propriedades.test.ts`

**Interfaces:**

- Consumes: `httpUrlSchema` de `@agro/validation`; `propriedadeResponseSchema`, `PropriedadeResponse` de `@agro/contracts`.
- Produces: `listarPropriedades(baseUrl, fetcher?) => Promise<PropriedadeResponse[]>`, `criarPropriedade(baseUrl, { nome: string; areaHa: number }, fetcher?) => Promise<PropriedadeResponse>`, `editarPropriedade(baseUrl, id: string, { nome: string; areaHa: number }, fetcher?) => Promise<PropriedadeResponse>`, `apagarPropriedade(baseUrl, id: string, fetcher?) => Promise<void>`. Consumidos pela Task 8.

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  apagarPropriedade,
  criarPropriedade,
  editarPropriedade,
  listarPropriedades,
} from './propriedades';

const propriedade = {
  id: '1',
  nome: 'Fazenda Boa Vista',
  areaHa: '120.5000',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('listarPropriedades', () => {
  it('lists properties with credentials:"include" and resolves with the parsed body', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [propriedade] });
    const resultado = await listarPropriedades(
      'http://localhost:3001',
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/propriedades'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(resultado).toEqual([propriedade]);
  });
});

describe('criarPropriedade', () => {
  it('posts the new property and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => propriedade });
    const resultado = await criarPropriedade(
      'http://localhost:3001',
      { nome: 'Fazenda Boa Vista', areaHa: 120.5 },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/propriedades'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    expect(resultado).toEqual(propriedade);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'nome é obrigatório' }),
    });
    await expect(
      criarPropriedade(
        'http://localhost:3001',
        { nome: '', areaHa: 120.5 },
        fetcher,
      ),
    ).rejects.toThrow('nome é obrigatório');
  });
});

describe('editarPropriedade', () => {
  it('patches the property and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => propriedade });
    const resultado = await editarPropriedade(
      'http://localhost:3001',
      '1',
      { nome: 'Fazenda Boa Vista', areaHa: 120.5 },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/propriedades/1'),
      expect.objectContaining({ credentials: 'include', method: 'PATCH' }),
    );
    expect(resultado).toEqual(propriedade);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Propriedade não encontrada' }),
    });
    await expect(
      editarPropriedade(
        'http://localhost:3001',
        '1',
        { nome: 'Fazenda Boa Vista', areaHa: 120.5 },
        fetcher,
      ),
    ).rejects.toThrow('Propriedade não encontrada');
  });
});

describe('apagarPropriedade', () => {
  it('deletes the property with credentials:"include"', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await apagarPropriedade('http://localhost:3001', '1', fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/propriedades/1'),
      expect.objectContaining({ credentials: 'include', method: 'DELETE' }),
    );
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        message:
          'Não é possível excluir — já existe histórico vinculado a este registro.',
      }),
    });
    await expect(
      apagarPropriedade('http://localhost:3001', '1', fetcher),
    ).rejects.toThrow('já existe histórico vinculado');
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @agro/web test -- propriedades.test.ts`
Expected: FAIL com "Cannot find module './propriedades'" (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `apps/web/src/lib/propriedades.ts`**

```ts
import { httpUrlSchema } from '@agro/validation';
import {
  propriedadeResponseSchema,
  type PropriedadeResponse,
} from '@agro/contracts';
import { z } from 'zod';

export async function listarPropriedades(
  baseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<PropriedadeResponse[]> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/propriedades', url), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível listar propriedades');
  return z.array(propriedadeResponseSchema).parse(await response.json());
}

export async function criarPropriedade(
  baseUrl: string | undefined,
  dados: { nome: string; areaHa: number },
  fetcher: typeof fetch = fetch,
): Promise<PropriedadeResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/propriedades', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível criar a propriedade');
  }
  return propriedadeResponseSchema.parse(await response.json());
}

export async function editarPropriedade(
  baseUrl: string | undefined,
  id: string,
  dados: { nome: string; areaHa: number },
  fetcher: typeof fetch = fetch,
): Promise<PropriedadeResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/propriedades/${id}`, url), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível editar a propriedade');
  }
  return propriedadeResponseSchema.parse(await response.json());
}

export async function apagarPropriedade(
  baseUrl: string | undefined,
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/propriedades/${id}`, url), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível apagar a propriedade');
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @agro/web test -- propriedades.test.ts`
Expected: PASS, todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/propriedades.ts apps/web/src/lib/propriedades.test.ts
git commit -m "feat(web): add propriedades lib functions (list/create/edit/delete)"
```

---

### Task 5: `lib/procedimentos.ts`

**Files:**

- Create: `apps/web/src/lib/procedimentos.ts`
- Test: `apps/web/src/lib/procedimentos.test.ts`

**Interfaces:**

- Consumes: `httpUrlSchema` de `@agro/validation`; `procedimentoResponseSchema`, `ProcedimentoResponse`, `TipoProcedimento` de `@agro/contracts`.
- Produces: `listarProcedimentos(baseUrl, fetcher?) => Promise<ProcedimentoResponse[]>`, `criarProcedimento(baseUrl, { nome: string; tipo: TipoProcedimento }, fetcher?) => Promise<ProcedimentoResponse>`, `editarProcedimento(baseUrl, id: string, { nome: string; tipo: TipoProcedimento }, fetcher?) => Promise<ProcedimentoResponse>`, `apagarProcedimento(baseUrl, id: string, fetcher?) => Promise<void>`. Consumidos pela Task 9.

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  apagarProcedimento,
  criarProcedimento,
  editarProcedimento,
  listarProcedimentos,
} from './procedimentos';

const procedimento = {
  id: '1',
  nome: 'Aplicação de herbicida',
  tipo: 'APLICACAO',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('listarProcedimentos', () => {
  it('lists procedures with credentials:"include" and resolves with the parsed body', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [procedimento] });
    const resultado = await listarProcedimentos(
      'http://localhost:3001',
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/procedimentos'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(resultado).toEqual([procedimento]);
  });
});

describe('criarProcedimento', () => {
  it('posts the new procedure and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => procedimento });
    const resultado = await criarProcedimento(
      'http://localhost:3001',
      { nome: 'Aplicação de herbicida', tipo: 'APLICACAO' },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/procedimentos'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    expect(resultado).toEqual(procedimento);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'nome é obrigatório' }),
    });
    await expect(
      criarProcedimento(
        'http://localhost:3001',
        { nome: '', tipo: 'APLICACAO' },
        fetcher,
      ),
    ).rejects.toThrow('nome é obrigatório');
  });
});

describe('editarProcedimento', () => {
  it('patches the procedure and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => procedimento });
    const resultado = await editarProcedimento(
      'http://localhost:3001',
      '1',
      { nome: 'Aplicação de herbicida', tipo: 'APLICACAO' },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/procedimentos/1'),
      expect.objectContaining({ credentials: 'include', method: 'PATCH' }),
    );
    expect(resultado).toEqual(procedimento);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Procedimento não encontrado' }),
    });
    await expect(
      editarProcedimento(
        'http://localhost:3001',
        '1',
        { nome: 'Aplicação de herbicida', tipo: 'APLICACAO' },
        fetcher,
      ),
    ).rejects.toThrow('Procedimento não encontrado');
  });
});

describe('apagarProcedimento', () => {
  it('deletes the procedure with credentials:"include"', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await apagarProcedimento('http://localhost:3001', '1', fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/procedimentos/1'),
      expect.objectContaining({ credentials: 'include', method: 'DELETE' }),
    );
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        message:
          'Não é possível excluir — já existe histórico vinculado a este registro.',
      }),
    });
    await expect(
      apagarProcedimento('http://localhost:3001', '1', fetcher),
    ).rejects.toThrow('já existe histórico vinculado');
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @agro/web test -- procedimentos.test.ts`
Expected: FAIL com "Cannot find module './procedimentos'".

- [ ] **Step 3: Implementar `apps/web/src/lib/procedimentos.ts`**

```ts
import { httpUrlSchema } from '@agro/validation';
import {
  procedimentoResponseSchema,
  type ProcedimentoResponse,
  type TipoProcedimento,
} from '@agro/contracts';
import { z } from 'zod';

export async function listarProcedimentos(
  baseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<ProcedimentoResponse[]> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/procedimentos', url), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível listar procedimentos');
  return z.array(procedimentoResponseSchema).parse(await response.json());
}

export async function criarProcedimento(
  baseUrl: string | undefined,
  dados: { nome: string; tipo: TipoProcedimento },
  fetcher: typeof fetch = fetch,
): Promise<ProcedimentoResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/procedimentos', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível criar o procedimento');
  }
  return procedimentoResponseSchema.parse(await response.json());
}

export async function editarProcedimento(
  baseUrl: string | undefined,
  id: string,
  dados: { nome: string; tipo: TipoProcedimento },
  fetcher: typeof fetch = fetch,
): Promise<ProcedimentoResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/procedimentos/${id}`, url), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível editar o procedimento');
  }
  return procedimentoResponseSchema.parse(await response.json());
}

export async function apagarProcedimento(
  baseUrl: string | undefined,
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/procedimentos/${id}`, url), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível apagar o procedimento');
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @agro/web test -- procedimentos.test.ts`
Expected: PASS, todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/procedimentos.ts apps/web/src/lib/procedimentos.test.ts
git commit -m "feat(web): add procedimentos lib functions (list/create/edit/delete)"
```

---

### Task 6: `lib/insumos.ts`

**Files:**

- Create: `apps/web/src/lib/insumos.ts`
- Test: `apps/web/src/lib/insumos.test.ts`

**Interfaces:**

- Consumes: `httpUrlSchema` de `@agro/validation`; `insumoResponseSchema`, `InsumoResponse` de `@agro/contracts`.
- Produces: `listarInsumos(baseUrl, fetcher?) => Promise<InsumoResponse[]>`, `criarInsumo(baseUrl, { nome: string; unidade: string; precoUnitarioAtual: number }, fetcher?) => Promise<InsumoResponse>`, `editarPrecoInsumo(baseUrl, id: string, { precoUnitarioAtual: number }, fetcher?) => Promise<InsumoResponse>`, `apagarInsumo(baseUrl, id: string, fetcher?) => Promise<void>`. Consumidos pela Task 10.

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  apagarInsumo,
  criarInsumo,
  editarPrecoInsumo,
  listarInsumos,
} from './insumos';

const insumo = {
  id: '1',
  nome: 'Ureia',
  unidade: 'kg',
  precoUnitarioAtual: '2.5000',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('listarInsumos', () => {
  it('lists inputs with credentials:"include" and resolves with the parsed body', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [insumo] });
    const resultado = await listarInsumos('http://localhost:3001', fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/insumos'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(resultado).toEqual([insumo]);
  });
});

describe('criarInsumo', () => {
  it('posts the new input and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => insumo });
    const resultado = await criarInsumo(
      'http://localhost:3001',
      { nome: 'Ureia', unidade: 'kg', precoUnitarioAtual: 2.5 },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/insumos'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    expect(resultado).toEqual(insumo);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'nome é obrigatório' }),
    });
    await expect(
      criarInsumo(
        'http://localhost:3001',
        { nome: '', unidade: 'kg', precoUnitarioAtual: 2.5 },
        fetcher,
      ),
    ).rejects.toThrow('nome é obrigatório');
  });
});

describe('editarPrecoInsumo', () => {
  it('patches only the price and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => insumo });
    const resultado = await editarPrecoInsumo(
      'http://localhost:3001',
      '1',
      { precoUnitarioAtual: 2.5 },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/insumos/1'),
      expect.objectContaining({ credentials: 'include', method: 'PATCH' }),
    );
    expect(resultado).toEqual(insumo);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Insumo não encontrado' }),
    });
    await expect(
      editarPrecoInsumo(
        'http://localhost:3001',
        '1',
        { precoUnitarioAtual: 2.5 },
        fetcher,
      ),
    ).rejects.toThrow('Insumo não encontrado');
  });
});

describe('apagarInsumo', () => {
  it('deletes the input with credentials:"include"', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await apagarInsumo('http://localhost:3001', '1', fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/insumos/1'),
      expect.objectContaining({ credentials: 'include', method: 'DELETE' }),
    );
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        message:
          'Não é possível excluir — já existe histórico vinculado a este registro.',
      }),
    });
    await expect(
      apagarInsumo('http://localhost:3001', '1', fetcher),
    ).rejects.toThrow('já existe histórico vinculado');
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `pnpm --filter @agro/web test -- insumos.test.ts`
Expected: FAIL com "Cannot find module './insumos'".

- [ ] **Step 3: Implementar `apps/web/src/lib/insumos.ts`**

```ts
import { httpUrlSchema } from '@agro/validation';
import { insumoResponseSchema, type InsumoResponse } from '@agro/contracts';
import { z } from 'zod';

export async function listarInsumos(
  baseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<InsumoResponse[]> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/insumos', url), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível listar insumos');
  return z.array(insumoResponseSchema).parse(await response.json());
}

export async function criarInsumo(
  baseUrl: string | undefined,
  dados: { nome: string; unidade: string; precoUnitarioAtual: number },
  fetcher: typeof fetch = fetch,
): Promise<InsumoResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/insumos', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível criar o insumo');
  }
  return insumoResponseSchema.parse(await response.json());
}

export async function editarPrecoInsumo(
  baseUrl: string | undefined,
  id: string,
  dados: { precoUnitarioAtual: number },
  fetcher: typeof fetch = fetch,
): Promise<InsumoResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/insumos/${id}`, url), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível editar o preço');
  }
  return insumoResponseSchema.parse(await response.json());
}

export async function apagarInsumo(
  baseUrl: string | undefined,
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/insumos/${id}`, url), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível apagar o insumo');
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `pnpm --filter @agro/web test -- insumos.test.ts`
Expected: PASS, todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/insumos.ts apps/web/src/lib/insumos.test.ts
git commit -m "feat(web): add insumos lib functions (list/create/edit price/delete)"
```

---

### Task 7: Layout de domínio com barra lateral

**Files:**

- Create: `apps/web/src/app/(dominio)/layout.tsx`

**Interfaces:**

- Consumes: `Pill` de `@agro/ui/pill` (Task 3).
- Produces: o layout compartilhado que envolve as páginas das Tasks 8, 9 e 10 (qualquer página criada em `apps/web/src/app/(dominio)/<rota>/page.tsx` herda esta barra lateral automaticamente — recurso de route group do Next.js App Router, não requer import explícito).

- [ ] **Step 1: Criar o diretório e o layout**

```bash
mkdir -p "apps/web/src/app/(dominio)"
```

```tsx
import Link from 'next/link';
import { Pill } from '@agro/ui/pill';

const AREAS_ATIVAS = [
  { href: '/propriedades', label: 'Propriedades' },
  { href: '/procedimentos', label: 'Procedimentos' },
  { href: '/insumos', label: 'Insumos' },
];

const AREAS_FUTURAS = [
  'Talhões',
  'Safras',
  'Planejamento',
  'Execução',
  'Compra de Insumo',
];

export default function DominioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-60 flex-col gap-1 border-r border-border bg-white px-4 py-6">
        <span className="mb-6 px-2 text-lg font-semibold tracking-wide text-primary">
          AGRO
        </span>
        <nav className="flex flex-col gap-1">
          {AREAS_ATIVAS.map((area) => (
            <Link
              key={area.href}
              href={area.href}
              className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-background"
            >
              {area.label}
            </Link>
          ))}
          {AREAS_FUTURAS.map((label) => (
            <span
              key={label}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground"
            >
              {label}
              <Pill variant="muted">Em breve</Pill>
            </span>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

Esse arquivo fica em `apps/web/src/app/(dominio)/layout.tsx` — o diretório `(dominio)` é um route group do Next.js (parênteses no nome), então ele NÃO aparece na URL: uma página em `apps/web/src/app/(dominio)/propriedades/page.tsx` é servida em `/propriedades`, não em `/dominio/propriedades`.

- [ ] **Step 2: Verificar**

Sem teste de renderização (mesmo padrão do resto do projeto). A verificação real acontece nas Tasks 8-10, quando existir ao menos uma página dentro do route group para o build processar.

Run: `pnpm --filter @agro/web typecheck`
Expected: passa sem erro (o layout compila mesmo sem páginas-filhas ainda).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(dominio)/layout.tsx"
git commit -m "feat(web): add fixed sidebar layout for domain screens"
```

---

### Task 8: Tela de Propriedades

**Files:**

- Create: `apps/web/src/app/(dominio)/propriedades/page.tsx`

**Interfaces:**

- Consumes: `Button` de `@agro/ui/button`; `Modal` de `@agro/ui/modal` (Task 2); `Input` de `@agro/ui/input` (Task 3); `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` de `@agro/ui/table` (Task 3); `listarPropriedades`, `criarPropriedade`, `editarPropriedade`, `apagarPropriedade` de `@/lib/propriedades` (Task 4); `PropriedadeResponse` de `@agro/contracts`.

- [ ] **Step 1: Criar a página**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@agro/ui/button';
import { Modal } from '@agro/ui/modal';
import { Input } from '@agro/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@agro/ui/table';
import {
  apagarPropriedade,
  criarPropriedade,
  editarPropriedade,
  listarPropriedades,
} from '@/lib/propriedades';
import type { PropriedadeResponse } from '@agro/contracts';

type ModalState =
  | { tipo: 'criar' }
  | { tipo: 'editar'; propriedade: PropriedadeResponse }
  | { tipo: 'apagar'; propriedade: PropriedadeResponse }
  | null;

export default function PropriedadesPage() {
  const [propriedades, setPropriedades] = useState<PropriedadeResponse[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [nome, setNome] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregarPropriedades() {
    return listarPropriedades(process.env.NEXT_PUBLIC_API_URL)
      .then((dados) => {
        setPropriedades(dados);
        setErroLista(null);
      })
      .catch((e: unknown) => {
        setErroLista(
          e instanceof Error
            ? e.message
            : 'Não foi possível listar propriedades',
        );
      })
      .finally(() => {
        setCarregandoLista(false);
      });
  }

  useEffect(() => {
    carregarPropriedades();
  }, []);

  function abrirCriar() {
    setNome('');
    setAreaHa('');
    setErroForm(null);
    setModal({ tipo: 'criar' });
  }

  function abrirEditar(propriedade: PropriedadeResponse) {
    setNome(propriedade.nome);
    setAreaHa(propriedade.areaHa);
    setErroForm(null);
    setModal({ tipo: 'editar', propriedade });
  }

  function abrirApagar(propriedade: PropriedadeResponse) {
    setErroForm(null);
    setModal({ tipo: 'apagar', propriedade });
  }

  function fecharModal() {
    setModal(null);
  }

  async function aoSalvar(event: React.FormEvent) {
    event.preventDefault();
    if (!modal || modal.tipo === 'apagar') return;
    setSalvando(true);
    setErroForm(null);
    try {
      const dados = { nome, areaHa: Number(areaHa) };
      if (modal.tipo === 'criar') {
        await criarPropriedade(process.env.NEXT_PUBLIC_API_URL, dados);
      } else {
        await editarPropriedade(
          process.env.NEXT_PUBLIC_API_URL,
          modal.propriedade.id,
          dados,
        );
      }
      fecharModal();
      await carregarPropriedades();
    } catch (e) {
      setErroForm(
        e instanceof Error
          ? e.message
          : 'Não foi possível salvar a propriedade',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function aoConfirmarExclusao() {
    if (!modal || modal.tipo !== 'apagar') return;
    setSalvando(true);
    setErroForm(null);
    try {
      await apagarPropriedade(
        process.env.NEXT_PUBLIC_API_URL,
        modal.propriedade.id,
      );
      fecharModal();
      await carregarPropriedades();
    } catch (e) {
      setErroForm(
        e instanceof Error
          ? e.message
          : 'Não foi possível apagar a propriedade',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Propriedades</h1>
        <Button onClick={abrirCriar}>Nova propriedade</Button>
      </div>

      {carregandoLista && <p>Carregando…</p>}
      {erroLista && (
        <p role="alert" className="text-sm text-red-600">
          {erroLista}
        </p>
      )}

      {!carregandoLista && !erroLista && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Área (ha)</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {propriedades.map((propriedade) => (
              <TableRow key={propriedade.id}>
                <TableCell>{propriedade.nome}</TableCell>
                <TableCell numeric>{propriedade.areaHa}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirEditar(propriedade)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirApagar(propriedade)}
                    >
                      Apagar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {propriedades.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-sm text-muted-foreground"
                  colSpan={3}
                >
                  Nenhuma propriedade cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Modal
        open={modal !== null && modal.tipo !== 'apagar'}
        onOpenChange={(open) => !open && fecharModal()}
        title={
          modal?.tipo === 'editar' ? 'Editar propriedade' : 'Nova propriedade'
        }
      >
        <form onSubmit={aoSalvar} className="space-y-4">
          <Input
            label="Nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Input
            label="Área (ha)"
            type="number"
            min={0}
            step="0.01"
            required
            value={areaHa}
            onChange={(e) => setAreaHa(e.target.value)}
          />
          {erroForm && (
            <p role="alert" className="text-sm text-red-600">
              {erroForm}
            </p>
          )}
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={modal?.tipo === 'apagar'}
        onOpenChange={(open) => !open && fecharModal()}
        title="Apagar propriedade"
      >
        {modal?.tipo === 'apagar' && (
          <div className="space-y-4">
            <p className="text-sm">
              Tem certeza que quer apagar{' '}
              <strong>{modal.propriedade.nome}</strong>? Essa ação não pode ser
              desfeita.
            </p>
            {erroForm && (
              <p role="alert" className="text-sm text-red-600">
                {erroForm}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button onClick={aoConfirmarExclusao} disabled={salvando}>
                {salvando ? 'Apagando…' : 'Apagar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
```

- [ ] **Step 2: Verificar**

Sem teste de renderização (mesmo padrão de `/usuarios` e `/admin/organizacoes`, que também não têm). A verificação é typecheck + build, e uma checagem manual real no navegador:

Run: `pnpm --filter @agro/web typecheck && pnpm --filter @agro/web build`
Expected: ambos passam sem erro.

Depois, com a API rodando (`pnpm --filter @agro/api dev`, banco Postgres no ar) e o front em modo dev (`pnpm --filter @agro/web dev`), abra `http://localhost:3000/propriedades` no navegador e confirme manualmente: a lista carrega, "Nova propriedade" abre o modal e cria um registro, "Editar" preenche o modal e salva a alteração, "Apagar" pede confirmação e remove o registro, e um erro real do backend (ex.: tentar apagar uma propriedade com talhão vinculado) aparece na tela com a mensagem do backend.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(dominio)/propriedades/page.tsx"
git commit -m "feat(web): add Propriedades catalog screen"
```

---

### Task 9: Tela de Procedimentos

**Files:**

- Create: `apps/web/src/app/(dominio)/procedimentos/page.tsx`

**Interfaces:**

- Consumes: `Button` de `@agro/ui/button`; `Modal` de `@agro/ui/modal`; `Input`, `Select` de `@agro/ui/input`; `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` de `@agro/ui/table`; `listarProcedimentos`, `criarProcedimento`, `editarProcedimento`, `apagarProcedimento` de `@/lib/procedimentos` (Task 5); `ProcedimentoResponse`, `TipoProcedimento` de `@agro/contracts`.

- [ ] **Step 1: Criar a página**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@agro/ui/button';
import { Modal } from '@agro/ui/modal';
import { Input, Select } from '@agro/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@agro/ui/table';
import {
  apagarProcedimento,
  criarProcedimento,
  editarProcedimento,
  listarProcedimentos,
} from '@/lib/procedimentos';
import type { ProcedimentoResponse, TipoProcedimento } from '@agro/contracts';

const OPCOES_TIPO: { value: TipoProcedimento; label: string }[] = [
  { value: 'APLICACAO', label: 'Aplicação' },
  { value: 'PLANTIO', label: 'Plantio' },
  { value: 'COLHEITA', label: 'Colheita' },
  { value: 'IRRIGACAO', label: 'Irrigação' },
  { value: 'OUTRO', label: 'Outro' },
];

type ModalState =
  | { tipo: 'criar' }
  | { tipo: 'editar'; procedimento: ProcedimentoResponse }
  | { tipo: 'apagar'; procedimento: ProcedimentoResponse }
  | null;

export default function ProcedimentosPage() {
  const [procedimentos, setProcedimentos] = useState<ProcedimentoResponse[]>(
    [],
  );
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoProcedimento>('APLICACAO');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregarProcedimentos() {
    return listarProcedimentos(process.env.NEXT_PUBLIC_API_URL)
      .then((dados) => {
        setProcedimentos(dados);
        setErroLista(null);
      })
      .catch((e: unknown) => {
        setErroLista(
          e instanceof Error
            ? e.message
            : 'Não foi possível listar procedimentos',
        );
      })
      .finally(() => {
        setCarregandoLista(false);
      });
  }

  useEffect(() => {
    carregarProcedimentos();
  }, []);

  function abrirCriar() {
    setNome('');
    setTipo('APLICACAO');
    setErroForm(null);
    setModal({ tipo: 'criar' });
  }

  function abrirEditar(procedimento: ProcedimentoResponse) {
    setNome(procedimento.nome);
    setTipo(procedimento.tipo);
    setErroForm(null);
    setModal({ tipo: 'editar', procedimento });
  }

  function abrirApagar(procedimento: ProcedimentoResponse) {
    setErroForm(null);
    setModal({ tipo: 'apagar', procedimento });
  }

  function fecharModal() {
    setModal(null);
  }

  async function aoSalvar(event: React.FormEvent) {
    event.preventDefault();
    if (!modal || modal.tipo === 'apagar') return;
    setSalvando(true);
    setErroForm(null);
    try {
      const dados = { nome, tipo };
      if (modal.tipo === 'criar') {
        await criarProcedimento(process.env.NEXT_PUBLIC_API_URL, dados);
      } else {
        await editarProcedimento(
          process.env.NEXT_PUBLIC_API_URL,
          modal.procedimento.id,
          dados,
        );
      }
      fecharModal();
      await carregarProcedimentos();
    } catch (e) {
      setErroForm(
        e instanceof Error
          ? e.message
          : 'Não foi possível salvar o procedimento',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function aoConfirmarExclusao() {
    if (!modal || modal.tipo !== 'apagar') return;
    setSalvando(true);
    setErroForm(null);
    try {
      await apagarProcedimento(
        process.env.NEXT_PUBLIC_API_URL,
        modal.procedimento.id,
      );
      fecharModal();
      await carregarProcedimentos();
    } catch (e) {
      setErroForm(
        e instanceof Error
          ? e.message
          : 'Não foi possível apagar o procedimento',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Procedimentos</h1>
        <Button onClick={abrirCriar}>Novo procedimento</Button>
      </div>

      {carregandoLista && <p>Carregando…</p>}
      {erroLista && (
        <p role="alert" className="text-sm text-red-600">
          {erroLista}
        </p>
      )}

      {!carregandoLista && !erroLista && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {procedimentos.map((procedimento) => (
              <TableRow key={procedimento.id}>
                <TableCell>{procedimento.nome}</TableCell>
                <TableCell>
                  {OPCOES_TIPO.find((o) => o.value === procedimento.tipo)
                    ?.label ?? procedimento.tipo}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirEditar(procedimento)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirApagar(procedimento)}
                    >
                      Apagar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {procedimentos.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-sm text-muted-foreground"
                  colSpan={3}
                >
                  Nenhum procedimento cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Modal
        open={modal !== null && modal.tipo !== 'apagar'}
        onOpenChange={(open) => !open && fecharModal()}
        title={
          modal?.tipo === 'editar' ? 'Editar procedimento' : 'Novo procedimento'
        }
      >
        <form onSubmit={aoSalvar} className="space-y-4">
          <Input
            label="Nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Select
            label="Tipo"
            required
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoProcedimento)}
            options={OPCOES_TIPO}
          />
          {erroForm && (
            <p role="alert" className="text-sm text-red-600">
              {erroForm}
            </p>
          )}
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={modal?.tipo === 'apagar'}
        onOpenChange={(open) => !open && fecharModal()}
        title="Apagar procedimento"
      >
        {modal?.tipo === 'apagar' && (
          <div className="space-y-4">
            <p className="text-sm">
              Tem certeza que quer apagar{' '}
              <strong>{modal.procedimento.nome}</strong>? Essa ação não pode ser
              desfeita.
            </p>
            {erroForm && (
              <p role="alert" className="text-sm text-red-600">
                {erroForm}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button onClick={aoConfirmarExclusao} disabled={salvando}>
                {salvando ? 'Apagando…' : 'Apagar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
```

- [ ] **Step 2: Verificar**

Sem teste de renderização (mesmo padrão do restante do projeto).

Run: `pnpm --filter @agro/web typecheck && pnpm --filter @agro/web build`
Expected: ambos passam sem erro.

Depois, com a API e o front em modo dev, abra `http://localhost:3000/procedimentos` e confirme manualmente: lista carrega, criar/editar troca entre os 5 tipos no select, apagar pede confirmação, e um erro real do backend aparece com a mensagem correta.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(dominio)/procedimentos/page.tsx"
git commit -m "feat(web): add Procedimentos catalog screen"
```

---

### Task 10: Tela de Insumos

**Files:**

- Create: `apps/web/src/app/(dominio)/insumos/page.tsx`

**Interfaces:**

- Consumes: `Button` de `@agro/ui/button`; `Modal` de `@agro/ui/modal`; `Input` de `@agro/ui/input`; `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` de `@agro/ui/table`; `listarInsumos`, `criarInsumo`, `editarPrecoInsumo`, `apagarInsumo` de `@/lib/insumos` (Task 6); `InsumoResponse` de `@agro/contracts`.

- [ ] **Step 1: Criar a página**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@agro/ui/button';
import { Modal } from '@agro/ui/modal';
import { Input } from '@agro/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@agro/ui/table';
import {
  apagarInsumo,
  criarInsumo,
  editarPrecoInsumo,
  listarInsumos,
} from '@/lib/insumos';
import type { InsumoResponse } from '@agro/contracts';

type ModalState =
  | { tipo: 'criar' }
  | { tipo: 'editar'; insumo: InsumoResponse }
  | { tipo: 'apagar'; insumo: InsumoResponse }
  | null;

export default function InsumosPage() {
  const [insumos, setInsumos] = useState<InsumoResponse[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('');
  const [precoUnitarioAtual, setPrecoUnitarioAtual] = useState('');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregarInsumos() {
    return listarInsumos(process.env.NEXT_PUBLIC_API_URL)
      .then((dados) => {
        setInsumos(dados);
        setErroLista(null);
      })
      .catch((e: unknown) => {
        setErroLista(
          e instanceof Error ? e.message : 'Não foi possível listar insumos',
        );
      })
      .finally(() => {
        setCarregandoLista(false);
      });
  }

  useEffect(() => {
    carregarInsumos();
  }, []);

  function abrirCriar() {
    setNome('');
    setUnidade('');
    setPrecoUnitarioAtual('');
    setErroForm(null);
    setModal({ tipo: 'criar' });
  }

  function abrirEditar(insumo: InsumoResponse) {
    setPrecoUnitarioAtual(insumo.precoUnitarioAtual);
    setErroForm(null);
    setModal({ tipo: 'editar', insumo });
  }

  function abrirApagar(insumo: InsumoResponse) {
    setErroForm(null);
    setModal({ tipo: 'apagar', insumo });
  }

  function fecharModal() {
    setModal(null);
  }

  async function aoCriar(event: React.FormEvent) {
    event.preventDefault();
    setSalvando(true);
    setErroForm(null);
    try {
      await criarInsumo(process.env.NEXT_PUBLIC_API_URL, {
        nome,
        unidade,
        precoUnitarioAtual: Number(precoUnitarioAtual),
      });
      fecharModal();
      await carregarInsumos();
    } catch (e) {
      setErroForm(
        e instanceof Error ? e.message : 'Não foi possível criar o insumo',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function aoEditarPreco(event: React.FormEvent) {
    event.preventDefault();
    if (!modal || modal.tipo !== 'editar') return;
    setSalvando(true);
    setErroForm(null);
    try {
      await editarPrecoInsumo(
        process.env.NEXT_PUBLIC_API_URL,
        modal.insumo.id,
        {
          precoUnitarioAtual: Number(precoUnitarioAtual),
        },
      );
      fecharModal();
      await carregarInsumos();
    } catch (e) {
      setErroForm(
        e instanceof Error ? e.message : 'Não foi possível editar o preço',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function aoConfirmarExclusao() {
    if (!modal || modal.tipo !== 'apagar') return;
    setSalvando(true);
    setErroForm(null);
    try {
      await apagarInsumo(process.env.NEXT_PUBLIC_API_URL, modal.insumo.id);
      fecharModal();
      await carregarInsumos();
    } catch (e) {
      setErroForm(
        e instanceof Error ? e.message : 'Não foi possível apagar o insumo',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Insumos</h1>
        <Button onClick={abrirCriar}>Novo insumo</Button>
      </div>

      {carregandoLista && <p>Carregando…</p>}
      {erroLista && (
        <p role="alert" className="text-sm text-red-600">
          {erroLista}
        </p>
      )}

      {!carregandoLista && !erroLista && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Preço unitário</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {insumos.map((insumo) => (
              <TableRow key={insumo.id}>
                <TableCell>{insumo.nome}</TableCell>
                <TableCell>{insumo.unidade}</TableCell>
                <TableCell numeric>{insumo.precoUnitarioAtual}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirEditar(insumo)}
                    >
                      Editar preço
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirApagar(insumo)}
                    >
                      Apagar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {insumos.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-sm text-muted-foreground"
                  colSpan={4}
                >
                  Nenhum insumo cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Modal
        open={modal?.tipo === 'criar'}
        onOpenChange={(open) => !open && fecharModal()}
        title="Novo insumo"
      >
        <form onSubmit={aoCriar} className="space-y-4">
          <Input
            label="Nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Input
            label="Unidade"
            required
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
          />
          <Input
            label="Preço unitário"
            type="number"
            min={0}
            step="0.0001"
            required
            value={precoUnitarioAtual}
            onChange={(e) => setPrecoUnitarioAtual(e.target.value)}
          />
          {erroForm && (
            <p role="alert" className="text-sm text-red-600">
              {erroForm}
            </p>
          )}
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={modal?.tipo === 'editar'}
        onOpenChange={(open) => !open && fecharModal()}
        title="Editar preço"
      >
        <form onSubmit={aoEditarPreco} className="space-y-4">
          <Input
            label="Preço unitário"
            type="number"
            min={0}
            step="0.0001"
            required
            value={precoUnitarioAtual}
            onChange={(e) => setPrecoUnitarioAtual(e.target.value)}
          />
          {erroForm && (
            <p role="alert" className="text-sm text-red-600">
              {erroForm}
            </p>
          )}
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={modal?.tipo === 'apagar'}
        onOpenChange={(open) => !open && fecharModal()}
        title="Apagar insumo"
      >
        {modal?.tipo === 'apagar' && (
          <div className="space-y-4">
            <p className="text-sm">
              Tem certeza que quer apagar <strong>{modal.insumo.nome}</strong>?
              Essa ação não pode ser desfeita.
            </p>
            {erroForm && (
              <p role="alert" className="text-sm text-red-600">
                {erroForm}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button onClick={aoConfirmarExclusao} disabled={salvando}>
                {salvando ? 'Apagando…' : 'Apagar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
```

- [ ] **Step 2: Verificar**

Sem teste de renderização (mesmo padrão do restante do projeto).

Run: `pnpm --filter @agro/web typecheck && pnpm --filter @agro/web build`
Expected: ambos passam sem erro.

Depois, com a API e o front em modo dev, abra `http://localhost:3000/insumos` e confirme manualmente: lista carrega, criar pede os 3 campos, "Editar preço" abre um modal só com o preço, apagar pede confirmação, e um erro real do backend aparece com a mensagem correta.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(dominio)/insumos/page.tsx"
git commit -m "feat(web): add Insumos catalog screen"
```

---

## Depois da última tarefa

Rode a suíte completa do monorepo antes de considerar o plano concluído:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Todos devem passar. Em seguida, com a API e o Postgres no ar, suba `pnpm --filter @agro/web dev` e percorra manualmente as 3 telas (`/propriedades`, `/procedimentos`, `/insumos`) a partir da barra lateral, confirmando o fluxo completo de criar/editar/apagar em cada uma e que as 5 áreas futuras aparecem bloqueadas com o selo "Em breve".
