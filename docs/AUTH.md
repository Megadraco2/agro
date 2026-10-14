# Autenticação e autorização

Não implementadas nesta fase. Health, documentação e todos os recursos do domínio de Gestão Agrícola
(/propriedades, /talhoes, /safras etc.) estão acessíveis sem autenticação — não há usuários fictícios, login simulado, JWT, cookies de sessão ou secrets no frontend.

Toda entidade já carrega `organizacaoId`, resolvido hoje por `CurrentOrganizationService` contra uma única
organização padrão semeada por migration (ver docs/DATABASE.md) — não há isolamento real entre organizações
ainda, só a modelagem pronta pra quando existir. Quando a auth for desenhada, essa resolução passa a vir da
sessão/token em vez de uma constante fixa; o restante do código (toda consulta já filtrada por organizacaoId)
não deveria precisar mudar.

Antes de recursos privados, decidir provedor de identidade, sessão, expiração/revogação, proteção CSRF quando aplicável e autorização no backend.
Definir isolamento entre organizações antes de qualquer modelo SaaS. Nunca aceitar tenant informado pelo cliente como prova de autorização.
Contratos públicos não devem exportar configurações privadas. NEXT_PUBLIC_* só pode conter informações públicas.
