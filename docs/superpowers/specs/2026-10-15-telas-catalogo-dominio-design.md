# Telas de Catálogo do Domínio Agrícola — Design

## Contexto

O backend do domínio de Gestão Agrícola está completo, incluindo CRUD completo (DELETE em 5 entidades de
catálogo + condicional em Planejamento, GET por id e PATCH onde faltava — ver
`docs/superpowers/specs/2026-10-14-crud-completo-dominio-design.md`). A autenticação/multiempresa também
está completa. Hoje o frontend (`apps/web`) não tem nenhuma tela do domínio agrícola em si — só a home de
verificação de saúde da API, `/login`, `/admin/login`, `/usuarios`, `/admin/organizacoes`.

Dado que o domínio tem 8 entidades, o trabalho de frontend foi decomposto em dois sub-projetos (decisão já
tomada e aprovada, não revisitada aqui):

1. **Sistema de design + telas de catálogo** (este documento) — identidade visual, componentes
   compartilhados, aplicados nas 3 entidades mais simples: Propriedade, Procedimento, Insumo.
2. **Núcleo de Gestão Agrícola** (próximo ciclo spec→plano→implementação) — o fluxo central Safra × Talhão
   com Planejamento/Execução/Compra de Insumo.

A sequência de prioridades do produto, já decidida pelo usuário: autenticação (feita) → CRUD do backend
(feito) → telas de catálogo (este documento) → núcleo de Gestão Agrícola → emissão de nota fiscal → outros
pontos (ex. produção em Kubernetes).

## Identidade visual

**Paleta:** verde `#176442` (já era o `theme_color` do manifest PWA, mantido como ponto de partida) + dourado
de trigo `#e8b65a` como cor secundária + fundo papel quente `#fdfbf6`. Testada e aprovada via protótipo visual
no navegador (3 direções comparadas: "Campo & Precisão" serifada, "Grão & Dados" grotesca firme, "Horizonte"
quente com dourado — a direção final combina o tom quente do Horizonte com a tipografia do Grão & Dados).

Uma direção alternativa (navy escuro + ciano, inspirada num material de marketing da Bayer) foi considerada e
descartada deliberadamente: é uma paleta pensada pra impacto visual em mídia de marketing/evento, não pra uso
prolongado numa ferramenta de gestão (fundo escuro cansa mais em uso diário com tabelas/formulários), é a
paleta mais genérica de "SaaS corporativo" que existe (o oposto do objetivo de fugir de um visual
genérico), e pertence a uma marca concorrente específica.

**Tipografia:** Archivo (grotesca firme, um só peso de família pra tudo — títulos e corpo), carregada via
`next/font/google`. IBM Plex Mono só para números alinhados em tabela (área em ha, preços). Nenhuma das duas
é a dupla "seguro" de IA (Inter/Space Grotesk) nem o clichê creme+serifada+terracota.

**Tokens:** `apps/web/src/app/globals.css` já segue o padrão de mercado recomendado pro Tailwind v4 — CSS
custom properties em `:root`, expostas via `@theme inline`, consumidas como classes semânticas (`bg-primary`,
não hex direto). Este design estende o que já existe, não substitui: adiciona `--accent`/`--accent-foreground`
(o dourado), ajusta `--background` pro tom de papel mais quente, troca a fonte de Arial genérico pra Archivo.

## Decisões estruturais já aprovadas

- **Dispositivo:** desktop-first, responsivo (não quebra em tablet/celular, mas otimizado pra tela grande —
  tabelas e formulários densos). O Agrare (app de referência) também separa uso de escritório de uso em
  campo (que tem um app mobile offline próprio, fora do escopo daqui).
- **Navegação:** barra lateral fixa, recolhível em telas menores, com as 8 áreas de domínio listadas (3
  ativas agora — Propriedades, Procedimentos, Insumos — 5 bloqueadas visualmente até o sub-projeto 2 chegar:
  Talhões, Safras, Planejamento, Execução, Compra de Insumo).
- **Padrão de formulário:** modal/painel lateral pra criar e editar — mantém o usuário na lista, sem navegar
  pra uma rota própria. Mais rápido pra cadastro repetitivo, alinhado com o fluxo do Agrare.
- **Arquitetura de componentes:** componentes próprios por entidade (`PropriedadesTable`, `PropriedadeForm`,
  etc.), compostos de peças pequenas e compartilhadas em `@agro/ui` (`Table`, `Modal`, `Input`/`Select`,
  `Pill`) — não uma abstração genérica tipo `<EntityTable config={...}>` tentando servir as 8 entidades de
  uma vez. Com só 3 telas simples agora e 5 vindo depois com formatos bem diferentes (Talhão aninhado em
  Propriedade, Safra com datas, Planejamento com sub-itens de insumo), abstrair cedo é arriscado — ainda não
  se sabe a variação real. Revisitar uma abstração genérica só se o padrão realmente se repetir depois das 8.

## Componentes novos em `@agro/ui`

Mesmo padrão já estabelecido pelo `Button` existente (CVA + `cn()` de `clsx`+`tailwind-merge`, classes
semânticas dos tokens, Radix onde fizer sentido):

- **`Table`** — cabeçalho + linhas, números alinhados à direita em `IBM Plex Mono`.
- **`Modal`** — via Radix Dialog (o projeto já usa `@radix-ui/react-slot` no Button, então Radix já é uma
  dependência estabelecida).
- **`Input`/`Select`** — com label e mensagem de erro embutidos.
- **`Pill`** — pronto pra quando algum status real existir (nenhuma das 3 entidades desta fase tem um campo
  de status).

## As 3 telas

Campos e ações reais confirmados contra os DTOs/controllers do backend (não assumidos):

| Entidade         | Campos                                                          | Ações                                                                                         |
| ---------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Propriedade**  | nome, areaHa                                                    | Criar, Editar (nome+área), Apagar                                                             |
| **Procedimento** | nome, tipo (select: APLICACAO/PLANTIO/COLHEITA/IRRIGACAO/OUTRO) | Criar, Editar (nome+tipo — capacidade nova do backend), Apagar                                |
| **Insumo**       | nome, unidade, precoUnitarioAtual                               | Criar (3 campos), Editar preço (só o preço — nome/unidade são fixos depois de criado), Apagar |

Cada tela: tabela com os dados reais, botão "Novo X" abrindo o modal de criação, ação de editar por linha
abrindo o modal preenchido, ação de apagar por linha abrindo um modal de confirmação
("Tem certeza que quer apagar [nome]? Essa ação não pode ser desfeita.") antes de chamar o DELETE.

**Erros do backend sempre aparecem com a mensagem real:**

- DELETE com vínculo → 400, mensagem do backend ("Não é possível excluir — já existe histórico vinculado a
  este registro.") exibida no lugar de uma mensagem genérica.
- Qualquer 404/400 de validação → mesma mensagem real, mesmo padrão já usado em `/usuarios`.

## `lib/` — funções por entidade

Mesmo padrão de `apps/web/src/lib/auth.ts`/`usuarios.ts`/`organizacoes.ts`: função pura, fetcher injetável
(default `fetch`), `credentials: 'include'`, valida a URL base com `httpUrlSchema`, parseia a resposta com o
schema Zod correspondente de `@agro/contracts` (já existem: `propriedadeResponseSchema`,
`procedimentoResponseSchema`, `insumoResponseSchema`).

- `apps/web/src/lib/propriedades.ts` — `listarPropriedades`, `criarPropriedade`, `editarPropriedade`,
  `apagarPropriedade`.
- `apps/web/src/lib/procedimentos.ts` — `listarProcedimentos`, `criarProcedimento`, `editarProcedimento`,
  `apagarProcedimento`.
- `apps/web/src/lib/insumos.ts` — `listarInsumos`, `criarInsumo`, `editarPrecoInsumo`, `apagarInsumo`.

`apagarX` não retorna corpo (o backend responde 204) — a função resolve `Promise<void>` e lança erro com a
mensagem real do backend se a resposta não for `ok`.

## Testes

Segue o padrão já estabelecido: cada função de `lib/` tem 1-2 testes (sucesso + erro) com fetcher mockado,
sem teste de renderização de componente (esse projeto não testa componentes React ainda, só a camada de
dados/lógica).

## Fora de escopo

- As 5 telas restantes (Talhão, Safra, Procedimento→Planejamento/Execução, Compra de Insumo) — sub-projeto 2,
  próximo ciclo.
- Papel/permissão diferenciada nas ações de editar/apagar — o backend não distingue `ORG_ADMIN`/`ORG_MEMBER`
  pra essas operações ainda (decisão já tomada no CRUD do backend), então o frontend também não precisa.
- Paginação — o backend não pagina ainda.
- Emissão de nota fiscal, produção em Kubernetes — fora de escopo, fila de prioridades já definida.
