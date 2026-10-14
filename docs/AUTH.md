# Autenticação e autorização

Dois mundos de sessão independentes e paralelos, sem relação entre si:

- **Admin de sistema** (`AdminSistema`): opera a plataforma, cria organizações. Sessão em
  `SessaoAdminSistema`, cookie `agro_admin_session`, guard `AdminAuthGuard`.
- **Usuário de organização** (`Usuario`): membro de uma organização, usa o domínio de Gestão
  Agrícola. Sessão em `SessaoUsuario`, cookie `agro_session`, guard `AuthGuard`. Dois papéis:
  `ORG_ADMIN` (gerencia usuários da própria organização) e `ORG_MEMBER`.

Ambas as sessões são registros revogáveis em banco, não JWT stateless — de propósito, para que
logout e expiração tenham efeito imediato (revogar uma linha, em vez de esperar um token expirar
por conta própria). A cada uso válido, a expiração **da linha de sessão no banco** (`expiraEm`)
desliza para +7 dias. O cookie em si não desliza: o `maxAge` dele é fixado em 7 dias no login e
não é reemitido nas requisições seguintes, então o navegador descarta o cookie 7 dias depois do
login independentemente de atividade. Na prática, mesmo uma sessão usada continuamente dura no
máximo 7 dias a partir do login (limitação conhecida — ver "Considerações para deploy em
Kubernetes" abaixo).

## Tokens de sessão

O valor do cookie é um token aleatório de 256 bits (`randomBytes(32)` em base64url, gerado por
`gerarTokenSessao()` em `apps/api/src/common/sessao-token.ts`), não o `id` da linha de sessão. O
banco guarda só o SHA-256 do token (`tokenHash`, único); login, logout e os guards fazem o hash do
cookie recebido e buscam por `tokenHash`. Assim, acesso de leitura ao banco (backup, réplica, dump)
não basta para sequestrar uma sessão. O `id` (cuid) continua existindo como chave primária interna.

## Cookies

| Mundo                  | Cookie               | Guard            | Tabela de sessão     |
| ---------------------- | -------------------- | ---------------- | -------------------- |
| Admin de sistema       | `agro_admin_session` | `AdminAuthGuard` | `SessaoAdminSistema` |
| Usuário de organização | `agro_session`       | `AuthGuard`      | `SessaoUsuario`      |

Ambos os cookies são `httpOnly`, `sameSite=lax`, e `secure` apenas quando `NODE_ENV=production`
(em dev local sobre HTTP puro, um cookie `secure` seria descartado silenciosamente pelo navegador).
CORS é habilitado com `credentials: true` e `origin` restrito a `CORS_ORIGIN` — sem isso o
navegador não envia os cookies de sessão nas requisições cross-origin do frontend.

## Rotas

- `POST /auth/login`, `POST /auth/logout` — sessão de usuário de organização.
- `GET /usuarios`, `POST /usuarios` — lista/cria usuários da organização do chamador. `POST`
  exige `ORG_ADMIN` e respeita o limite de vagas (`Organizacao.maxUsuarios`, retorna 400 ao
  esgotar).
- `POST /admin/auth/login`, `POST /admin/auth/logout` — sessão de admin de sistema.
- `GET /admin/organizacoes`, `POST /admin/organizacoes` — lista/cria organizações. O `POST` cria a
  `Organizacao` e seu primeiro `Usuario` (`ORG_ADMIN`) numa única transação.

`POST /auth/login` e `POST /admin/auth/login` têm rate limiting (`@nestjs/throttler`, 5
requisições/60s, aplicado só nessas duas rotas via `@UseGuards(ThrottlerGuard)` no método, não
globalmente). `main.ts` configura o `trust proxy` do Express com `TRUST_PROXY_HOPS` (padrão `1`)
para que o throttler veja o IP real do cliente atrás do(s) proxy(s) reverso(s) (ex.: ingress do
Kubernetes). O valor precisa bater com o número real de hops: menos que o real faz todos os
clientes caírem no mesmo balde (o IP visto é o do proxy); mais que o real permite que um cliente
forje o próprio IP via header `X-Forwarded-For` e escape do limite.

## `AuthGuard` é global

`AuthGuard` é registrado como provider `APP_GUARD` em `AuthModule` (não via
`app.useGlobalGuards()` em `main.ts` — essa chamada só afetaria a instância criada ali, não as
instâncias de app que os testes criam diretamente a partir de `AppModule`). Isso protege as 8
rotas de domínio pré-existentes (Propriedade, Talhão, Safra, Procedimento, Insumo, Planejamento,
Execução, Compra de Insumo) sem precisar decorar cada uma.

Quatro controllers são explicitamente isentos via `@Public()`: `HealthController`,
`AuthController`, `AdminAuthController` e `AdminOrganizacoesController` — este último continua
exigindo sua própria autenticação separada via `AdminAuthGuard`, só está isento do `AuthGuard` de
usuário (que não se aplica a ele).

## Bootstrap do admin de sistema

`AdminBootstrapService` roda no boot da aplicação (`OnModuleInit`) e cria o primeiro
`AdminSistema` de forma idempotente: se já existe algum `AdminSistema` na tabela, não faz nada. Se
a tabela estiver vazia, lê `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD` do ambiente e cria o
admin com essas credenciais; se a tabela estiver vazia **e** essas variáveis não estiverem
definidas, a aplicação falha ao subir (não há como logar como admin de sistema sem isso). Depois
que o primeiro admin existe, essas variáveis deixam de ser lidas.

## Isolamento entre organizações

Toda entidade carrega `organizacaoId` (ver docs/DATABASE.md). `CurrentOrganizationService.getId()`
resolve a organização a partir da sessão autenticada (via `CurrentUserService`, request-scoped),
não mais de uma constante fixa.

Todo lookup por id, nas 8 entidades do domínio de Gestão Agrícola, agora filtra pela organização
do chamador — isso inclui o caso especial de `Talhão`, que não tem coluna `organizacaoId` própria
e é escopado pela relação com `Propriedade` (ver `apps/api/src/talhoes/talhoes.service.ts`:
`getOrThrow` busca com `where: { id, propriedade: { organizacaoId } }`, em vez de só `{ id }`).
Antes dessa correção (Task 6 do plano de autenticação), um usuário autenticado podia acessar por
id um registro de outra organização; isso está corrigido e coberto por teste.

## Considerações para deploy em Kubernetes

Limitações conhecidas, a tratar quando os manifests reais de produção forem escritos (não
resolvidas nesta fase):

- **Rate limit é por pod.** O `@nestjs/throttler` usa armazenamento em memória (padrão); com N
  réplicas, o limite efetivo é 5×N requisições por janela de 60s (cada pod conta separado), e o
  contador zera quando o pod reinicia. Um limite preciso entre réplicas exige um store
  compartilhado (ex.: Redis).
- **`TRUST_PROXY_HOPS` depende da topologia.** Ingress + load balancer de nuvem na frente podem
  somar mais de um hop; conferir o valor real (ver "Rotas" acima) antes de confiar no rate limit.
- **Web e API precisam compartilhar o domínio registrável.** Os cookies são `sameSite=lax` e o
  frontend chama a API cross-origin com `credentials: 'include'`. Isso só funciona se as origens
  forem do mesmo site (ex.: `app.exemplo.com` e `api.exemplo.com`). Em domínios realmente
  diferentes, o login parece funcionar (a resposta é 200 e traz `Set-Cookie`), mas o cookie nunca
  é enviado de volta nas requisições seguintes.
- **Bootstrap do admin concorrente.** `AdminBootstrapService` roda no boot de todo pod. Se várias
  réplicas sobem ao mesmo tempo com a tabela `AdminSistema` vazia, mais de uma tenta criar o admin
  inicial; a constraint de email único faz todas menos uma falharem com erro do Prisma e entrarem
  em crash-loop uma vez — o Kubernetes as reinicia e, na nova tentativa, elas veem que o admin já
  existe e sobem normalmente. Auto-corrigível, mas gera ruído nos logs.
- **`secure` do cookie depende de `NODE_ENV=production`.** O Dockerfile do projeto já define isso,
  mas se um manifest sobrescrever `NODE_ENV` com outro valor, os cookies de sessão passam a ser
  emitidos sem `secure` silenciosamente.
- **Duração máxima da sessão no navegador é fixa.** Como descrito no início deste documento, só a
  expiração no banco desliza; o cookie expira 7 dias após o login mesmo com uso contínuo.

## Fora de escopo

Self-signup, "esqueci minha senha", OAuth/SSO, papéis granulares além de `ORG_ADMIN`/`ORG_MEMBER`
e telas de domínio com controle de acesso por papel não foram implementados nesta fase.
