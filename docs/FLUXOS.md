# Fluxos do sistema

Documento vivo — atualize os diagramas sempre que um fluxo de autenticação ou de domínio mudar. Cores por
papel: **laranja** = admin de sistema, **azul** = usuário chefe (ORG_ADMIN), **verde** = usuário membro
(ORG_MEMBER), **cinza** = sistema (API/banco).

> Status: reflete o design em `docs/superpowers/specs/2026-10-14-autenticacao-multiempresa-design.md`,
> ainda não implementado. Atualize este arquivo junto com o código quando a implementação acontecer.

## Visão geral

```mermaid
flowchart LR
    classDef admin fill:#f9a95a,stroke:#b5641a,color:#1a1a1a
    classDef chefe fill:#6fb3e0,stroke:#1f6d9c,color:#1a1a1a
    classDef membro fill:#7fc98f,stroke:#2e7d46,color:#1a1a1a
    classDef sistema fill:#d9d9d9,stroke:#6b6b6b,color:#1a1a1a

    AdminNav["Admin de sistema<br/>/admin/login"]:::admin
    ChefeNav["Usuário chefe<br/>/login"]:::chefe
    MembroNav["Usuário membro<br/>/login"]:::membro

    Web["apps/web (Next.js)"]:::sistema
    API["apps/api (NestJS)"]:::sistema
    AuthGuard["AuthGuard / AdminAuthGuard"]:::sistema
    DB["PostgreSQL<br/>Organizacao · Usuario · AdminSistema · Sessões"]:::sistema

    AdminNav --> Web
    ChefeNav --> Web
    MembroNav --> Web
    Web --> API
    API --> AuthGuard
    AuthGuard --> DB
```

## Jornada: Admin de sistema

```mermaid
flowchart TD
    classDef admin fill:#f9a95a,stroke:#b5641a,color:#1a1a1a
    classDef sistema fill:#d9d9d9,stroke:#6b6b6b,color:#1a1a1a
    classDef decisao fill:#fff3cd,stroke:#b5641a,color:#1a1a1a

    A1["Acessa /admin/login"]:::admin
    A2["POST /admin/auth/login"]:::sistema
    A3{"Credenciais válidas?"}:::decisao
    A4["401"]:::sistema
    A5["Cria SessaoAdminSistema<br/>cookie agro_admin_session"]:::sistema
    A6["Portal admin: /admin/organizacoes"]:::admin
    A7["POST /admin/organizacoes<br/>nome + maxUsuarios"]:::admin
    A8["Cria Organizacao + 1º Usuario (ORG_ADMIN)<br/>numa transação"]:::sistema
    A9["Organização pronta para uso"]:::sistema

    A1 --> A2 --> A3
    A3 -->|não| A4
    A3 -->|sim| A5 --> A6 --> A7 --> A8 --> A9
```

## Jornada: Usuário chefe (ORG_ADMIN)

```mermaid
flowchart TD
    classDef chefe fill:#6fb3e0,stroke:#1f6d9c,color:#1a1a1a
    classDef sistema fill:#d9d9d9,stroke:#6b6b6b,color:#1a1a1a
    classDef decisao fill:#fff3cd,stroke:#1f6d9c,color:#1a1a1a

    C1["Recebe credenciais do admin de sistema"]:::chefe
    C2["Acessa /login"]:::chefe
    C3["POST /auth/login"]:::sistema
    C4["Cria SessaoUsuario<br/>cookie agro_session"]:::sistema
    C5{"O que fazer?"}:::decisao
    C6["Usa o domínio agrícola<br/>(Propriedade, Safra, Planejamento...)"]:::chefe
    C7["/usuarios → cria usuário membro"]:::chefe
    C8{"usuario.count &lt; maxUsuarios?"}:::decisao
    C9["400: limite de vagas atingido"]:::sistema
    C10["Usuário membro criado"]:::sistema

    C1 --> C2 --> C3 --> C4 --> C5
    C5 -->|domínio| C6
    C5 -->|gestão de equipe| C7 --> C8
    C8 -->|não| C9
    C8 -->|sim| C10
```

## Jornada: Usuário membro (ORG_MEMBER)

```mermaid
flowchart TD
    classDef membro fill:#7fc98f,stroke:#2e7d46,color:#1a1a1a
    classDef sistema fill:#d9d9d9,stroke:#6b6b6b,color:#1a1a1a
    classDef bloqueado fill:#f4a3a3,stroke:#b03030,color:#1a1a1a

    M1["Recebe credenciais do usuário chefe"]:::membro
    M2["Acessa /login"]:::membro
    M3["POST /auth/login"]:::sistema
    M4["Cria SessaoUsuario<br/>cookie agro_session"]:::sistema
    M5["Usa o domínio agrícola<br/>(só dados da própria organização)"]:::membro
    M6["Tenta POST /usuarios"]:::membro
    M7["403: só ORG_ADMIN gerencia usuários"]:::bloqueado

    M1 --> M2 --> M3 --> M4 --> M5
    M5 -.tentativa fora do papel.-> M6 --> M7
```
