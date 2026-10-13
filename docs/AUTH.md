# Autenticação e autorização

Não implementadas nesta fase. O único recurso público é o health e a documentação.
Não existem usuários fictícios, login simulado, JWT, cookies de sessão ou secrets no frontend.

Antes de recursos privados, decidir provedor de identidade, sessão, expiração/revogação, proteção CSRF quando aplicável e autorização no backend.
Definir isolamento entre organizações antes de qualquer modelo SaaS. Nunca aceitar tenant informado pelo cliente como prova de autorização.
Contratos públicos não devem exportar configurações privadas. NEXT_PUBLIC_* só pode conter informações públicas.
