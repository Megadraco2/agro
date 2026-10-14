# Autenticação e Multiempresa — Design

## Contexto

O backend do domínio de Gestão Agrícola está completo (8 recursos REST: Propriedade, Talhão, Safra,
Procedimento, Insumo, Planejamento, Execução, Compra de Insumo), todos com `organizacaoId` no schema desde o
início — decisão deliberada para não precisar de migration quando a autenticação chegasse (ver
`docs/AUTH.md`). Hoje existe uma única `Organizacao`, semeada por migration, sem usuários, sem login, sem
sessão. `CurrentOrganizationService.getId()` resolve essa organização por um slug fixo
(`apps/api/src/organizacao/current-organization.service.ts`); todo controller/service chama esse serviço para
obter `organizacaoId`.

Este documento desenha o subsistema de autenticação e multiempresa: múltiplas organizações reais, cada uma
com seus próprios usuários, provisionadas por um admin de sistema através de um portal próprio.

## Achado que molda o design

`docs/AUTH.md` afirma que "toda consulta já filtrada por organizacaoId", mas isso é **falso** na prática: só
os métodos `list()` filtram por `organizacaoId`. Toda busca por id isolado (`getOrThrow`, `update`, checagem
de existência de FK antes de criar um registro filho) busca só por `id`, nas 8 entidades existentes. Hoje
isso não é explorável porque só existe uma organização — mas é o primeiro item que este design precisa
corrigir, não um detalhe de implementação posterior. Ver seção "Fechando o gap de isolamento" abaixo.

## Glossário

- **Admin de sistema** (`AdminSistema`): opera a plataforma, não pertence a nenhuma organização. Cria
  organizações e seus primeiros usuários através de um portal próprio (`/admin`). Não acessa dados do
  domínio agrícola.
- **Organização** (`Organizacao`): já existe no schema. Ganha `maxUsuarios`, o limite de vagas definido pelo
  admin de sistema na criação.
- **Usuário chefe** (`Usuario` com papel `ORG_ADMIN`): o primeiro usuário de cada organização, criado pelo
  admin de sistema. Pode criar/listar outros usuários da própria organização, respeitando `maxUsuarios`. Usa
  o domínio agrícola.
- **Usuário membro** (`Usuario` com papel `ORG_MEMBER`): usa só o domínio agrícola, sem gestão de usuários.
- **Sessão**: registro em `SessaoUsuario`/`SessaoAdminSistema`, revogável, referenciado por um id opaco num
  cookie `httpOnly`.

## Modelo de dados

```prisma
model AdminSistema {
  id         String   @id @default(cuid())
  email      String   @unique
  senhaHash  String
  createdAt  DateTime @default(now())

  sessoes  SessaoAdminSistema[]
}

model SessaoAdminSistema {
  id          String    @id @default(cuid())
  adminId     String
  expiraEm    DateTime
  revogadaEm  DateTime?
  createdAt   DateTime  @default(now())

  admin  AdminSistema @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@index([adminId])
}

enum PapelUsuario {
  ORG_ADMIN
  ORG_MEMBER
}

model Usuario {
  id             String        @id @default(cuid())
  organizacaoId  String
  email          String        @unique
  senhaHash      String
  papel          PapelUsuario
  createdAt      DateTime      @default(now())

  organizacao  Organizacao      @relation(fields: [organizacaoId], references: [id], onDelete: Cascade)
  sessoes      SessaoUsuario[]

  @@index([organizacaoId])
}

model SessaoUsuario {
  id          String    @id @default(cuid())
  usuarioId   String
  expiraEm    DateTime
  revogadaEm  DateTime?
  createdAt   DateTime  @default(now())

  usuario  Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@index([usuarioId])
}
```

`Organizacao` ganha um campo:

```prisma
model Organizacao {
  // ...campos existentes (id, slug, nome, createdAt)...
  maxUsuarios  Int       @default(5)
  usuarios     Usuario[]
}
```

Duas tabelas de sessão em vez de uma com FK polimórfica — evita esse anti-padrão, e os dois logins já são
fluxos separados por design (seção seguinte). `senhaHash` em ambas as tabelas de credencial usa `bcrypt`
(dependência nova: `bcrypt` + `@types/bcrypt`).

## Fluxos de autenticação

### Bootstrap do primeiro admin de sistema

Problema do ovo e da galinha: a API de admin exige estar autenticado como admin, então o primeiro admin não
pode ser criado por ela. No boot da aplicação (`main.ts`, antes de `app.listen()`), se `AdminSistema.count()
=== 0`, cria um admin lendo `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD` do ambiente. Idempotente — roda
em todo boot, só age quando a tabela está vazia, nunca sobrescreve um admin existente. Falha alto (lança e
impede o boot) se as variáveis estiverem ausentes E a tabela estiver vazia, para nunca subir sem conseguir
logar. Combina com o modelo de deploy já em uso (variáveis de ambiente / secret do Kubernetes), sem rota HTTP
nova e sem depender de acesso a terminal.

### Login de organização

`POST /auth/login` — recebe `{ email, senha }`, busca `Usuario` por email, verifica hash. Em caso de sucesso:
cria `SessaoUsuario` com `expiraEm = now() + 7 dias`, seta cookie `agro_session` (`httpOnly`, `secure`,
`sameSite=lax`) com o id da sessão. Cada request autenticado estende `expiraEm` em mais 7 dias (sessão
deslizante) — assim um usuário ativo nunca é deslogado, mas uma sessão abandonada expira sozinha em uma
semana. `POST /auth/logout` marca `revogadaEm = now()` e limpa o cookie.

### Login de admin de sistema

`POST /admin/auth/login` — mecânica idêntica, contra `AdminSistema`/`SessaoAdminSistema`, cookie com nome
diferente (`agro_admin_session`). Os dois cookies coexistem sem conflito no mesmo navegador.

### Resolução por request

`AuthGuard` (NestJS, aplicado globalmente às rotas do domínio): lê o cookie `agro_session`, busca
`SessaoUsuario` com `revogadaEm IS NULL AND expiraEm > now()`, carrega o `Usuario`, anexa
`{ usuarioId, organizacaoId, papel }` ao request via um provider `REQUEST`-scoped. 401 se ausente/inválida/
expirada/revogada.

`CurrentOrganizationService.getId()` para de resolver por slug fixo e passa a ler `organizacaoId` do request
autenticado atual. Única mudança no arquivo existente — todo o resto do código que já chama
`currentOrg.getId()` não muda.

`AdminAuthGuard` faz o mesmo para `/admin/*`, contra `SessaoAdminSistema`. A sessão deslizante (renovação de
`expiraEm` a cada request autenticado) vale para as duas tabelas de sessão, não só `SessaoUsuario`.

Ficam públicos (sem guard), sem mudança: `GET /health` (precisa responder sem sessão para healthcheck do
Kubernetes) e `GET /docs` (Swagger, já é público hoje).

`apps/api/src/setup.ts` troca `credentials: false` para `credentials: true` no `enableCors()` — obrigatório
para o navegador enviar/receber cookies entre `apps/web` e `apps/api` (origens diferentes); `origin` continua
sendo a URL exata do frontend (nunca `*` — `credentials: true` com `origin: '*'` é rejeitado pelo próprio
navegador, e seria inseguro mesmo que não fosse).

### Rate limiting

`@nestjs/throttler` (dependência nova) nos dois endpoints de login — proteção básica contra força bruta
(OWASP ASVS). Limite proposto: 5 tentativas por IP por minuto, nos dois (`/auth/login` e
`/admin/auth/login`).

## Fechando o gap de isolamento entre organizações

O gap não é só "`getOrThrow`/`update`" — é toda busca de uma entidade por id (isolado ou em lote) que hoje
usa só o id, sem checar a organização. Isso inclui as checagens de existência de FK antes de criar um
registro filho (ex: `safraId`/`talhaoId`/`procedimentoId` em `planejamentos.service.ts:89-91`), a validação
em lote de `insumoId[]` (`planejamentos.service.ts:106`, `execucoes.service.ts:130`), e a checagem do link
opcional `planejamentoItemId` (`execucoes.service.ts:113`) — não só os `getOrThrow` óbvios.

**Caso geral** (`Propriedade`, `Safra`, `Procedimento`, `Insumo`, `PlanejamentoItem`, `ExecucaoItem`,
`CompraInsumo` — todas têm `organizacaoId` próprio): troca `findUnique({ where: { id } })` por
`findFirst({ where: { id, organizacaoId } })` (lote: `findMany({ where: { id: { in: ids }, organizacaoId } })`,
e confere `resultado.length === ids.length` como já é feito hoje).

**Caso `Talhao`** (único sem `organizacaoId` próprio — só tem `propriedadeId`): a checagem passa pela relação:
`findFirst({ where: { id, propriedade: { organizacaoId } } })`. Afeta `talhoes.service.ts` (`getOrThrow` e
`getPropriedadeOrThrow`, que busca a `Propriedade` por id — essa sim tem `organizacaoId` próprio, caso geral)
e todo ponto que hoje faz `talhao.findUnique({ where: { id } })` fora do módulo de Talhão
(`planejamentos.service.ts:90`, `execucoes.service.ts:88`, `compras-insumo.service.ts:64`). O `list()` de
Talhão (`talhoes.service.ts:39`) não precisa de filtro próprio — já é seguro desde que
`getPropriedadeOrThrow(propriedadeId)` (chamado antes) esteja corrigido: uma vez provado que a Propriedade
pertence à organização atual, listar Talhões pelo `propriedadeId` já comprovado é seguro.

`organizacaoId` vem de `CurrentOrganizationService.getId()`, já resolvido pela sessão. Um registro de outra
organização passa a devolver 404 em vez de 200/sucesso, idêntico ao comportamento de "não existe".

Teste de regressão por entidade: criar um registro autenticado como organização A, autenticar como
organização B, confirmar 404 ao tentar ler/atualizar pelo id (e, pra `Talhao`/`Planejamento`/`Execução`/
`CompraInsumo`, confirmar 404 também ao tentar _referenciar_ um id de catálogo de outra organização, não só ao
ler/atualizar diretamente). Isso também resolve, de fato, o sub-caso do item #3 do `docs/BACKLOG.md` que
estava bloqueado por não haver uma segunda organização pra testar contra.

## Rotas

Novas:

- `POST /auth/login`, `POST /auth/logout` — organização.
- `GET /usuarios` — lista usuários da própria organização (qualquer papel pode listar).
- `POST /usuarios` — cria usuário na própria organização (só `ORG_ADMIN`; 400 se
  `usuario.count({ where: { organizacaoId } }) >= organizacao.maxUsuarios`).
- `POST /admin/auth/login` — admin de sistema.
- `POST /admin/organizacoes` — cria `Organizacao` + primeiro `Usuario` (`ORG_ADMIN`) + `maxUsuarios`, numa
  transação.
- `GET /admin/organizacoes` — lista organizações (nome, `maxUsuarios`, contagem de usuários).

Existentes: as 8 rotas do domínio agrícola passam a exigir `AuthGuard` (hoje são públicas).

## Frontend (apps/web)

Só as telas de autenticação nesta fase — nenhuma tela do domínio agrícola em si (decisão já tomada
separadamente, fora de escopo deste documento):

- `/login` — formulário de organização.
- `/admin/login` — formulário de admin de sistema, link discreto a partir de `/login` ("Acesso
  administrativo").
- `/usuarios` — lista + formulário de criação, visível só para `ORG_ADMIN` (o backend já recusa pra
  `ORG_MEMBER`; a tela só evita mostrar um formulário que vai falhar).
- `/admin/organizacoes` — lista + formulário de criação, dentro do portal admin.

## Documentação viva

`docs/FLUXOS.md` — diagramas Mermaid com cores (`classDef`/`style`, agrupamento por persona) cobrindo as três
jornadas (admin de sistema, usuário chefe, usuário membro) e um diagrama de visão geral (web ↔ api ↔ banco,
onde o `AuthGuard` entra). Atualizado daqui pra frente sempre que o fluxo de autenticação mudar, do mesmo
jeito que `docs/BACKLOG.md` é mantido vivo.

`docs/AUTH.md` é reescrito para refletir o que passa a existir (deixa de dizer "não implementadas nesta
fase"); `docs/DOMAIN.md` ganha uma nota sobre `Usuario`/`AdminSistema` não fazerem parte do domínio agrícola
em si (são identidade/acesso, não Gestão Agrícola).

## Testes

- Bootstrap idempotente do admin de sistema (não recria se já existe; falha ao subir sem admin nem env vars).
- Login/logout de organização e de admin de sistema (credenciais corretas, incorretas, usuário inexistente).
- Sessão expirada e sessão revogada são tratadas como não autenticado (401).
- Limite de vagas: `POST /usuarios` aceita até `maxUsuarios`, rejeita o `N+1`-ésimo com 400.
- Papel: `ORG_MEMBER` recebe 403 em `POST /usuarios`.
- Isolamento entre organizações: um teste de regressão por entidade (8 testes), como descrito acima.
- As 8 rotas do domínio agora recusam request sem sessão (401).

## Dados existentes

A organização "default" já seedada (com os dados de teste já criados nesta sessão) continua existindo —
ganha `maxUsuarios` (valor padrão, 5) e fica sem usuário até alguém (você, via portal admin, após o deploy)
criar o primeiro. Nenhuma senha é gerada ou commitada via migration.

## Fora de escopo (YAGNI, deliberado)

- Self-signup público — provisionamento é só via admin de sistema, por decisão explícita.
- "Esqueci minha senha" / recuperação por e-mail — não há infraestrutura de e-mail no projeto ainda; o
  `ORG_ADMIN` pode remover e recriar um usuário membro se necessário. Entra como decisão futura se o produto
  precisar.
- OAuth/login social — não solicitado.
- Papéis mais granulares que `ORG_ADMIN`/`ORG_MEMBER` — YAGNI até haver um caso de uso real pra mais
  granularidade.
- Telas do domínio agrícola em si — decisão já tomada em separado (próxima etapa escolhida foi autenticação,
  não telas).
