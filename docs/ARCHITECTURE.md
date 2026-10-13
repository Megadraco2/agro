# Arquitetura

```text
apps/web (Next App Router) ── HTTP REST ──> apps/api (NestJS)
        │                                      │
        └── contracts / validation ─────────────┘
        │                                      └── Prisma → PostgreSQL (preparado)
        └── ui
packages/typescript-config e eslint-config → ferramentas compartilhadas
```

Apps possuem build, processo, ambiente e implantação independentes. Não há proxy ou backend de negócio no Next.
Contratos públicos usam Zod e tipos inferidos. Pacotes contracts/validation são compilados antes dos consumidores pelo Turbo.
UI é código TSX compilado pelo Next e usa o padrão shadcn/ui (Radix, CVA, utilitário cn e tokens CSS).
Configurações TypeScript e ESLint são compartilhadas; TypeScript estrito.

Next 16, React 19, Tailwind 4, Nest 11 e Prisma 6.19 foram escolhidos para compatibilidade com Node 22.16.
Prisma 7 exige revisão de runtime/adapters; upgrade é uma decisão futura, não dependência desta fundação.
Dependências resolvidas estão fixadas em pnpm-lock.yaml; instalações reproduzíveis usam --frozen-lockfile.

Frontend conhece somente NEXT_PUBLIC_API_URL. A API valida o ambiente no início e limita CORS à origem configurada.
CORS não é autorização. Autenticação e isolamento SaaS precisam de desenho antes de quaisquer dados privados.
O health é liveness e não readiness do banco. Não há conexão Prisma em runtime até existir uso real.

Turbo coordena build, typecheck e testes; lint global cobre todo o repositório.
Build não exige banco, secrets ou acesso externo a fontes tipográficas.
Docker Compose provisiona PostgreSQL. Dockerfiles permitem empacotar cada app separadamente.
