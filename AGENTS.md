# Regras de engenharia

- Leia README.md e docs/ARCHITECTURE.md antes de alterar a arquitetura.
- Preserve apps/web e apps/api desacoplados. Não importe código de um app no outro.
- Compartilhe somente contratos públicos, validações puras, UI e configurações.
- Não crie funcionalidades, entidades ou dados fictícios sem solicitação.
- NestJS é a autoridade de validação e futura autorização. Validação no cliente não substitui backend.
- Nunca exponha segredos em NEXT_PUBLIC_*, respostas, logs, contratos ou Git.
- Mantenha arquivos .env locais ignorados e exemplos sem credenciais reais.
- Não armazene respostas de API, sessões ou dados privados no service worker.
- Documente alterações de contrato, ambiente, banco e estratégia PWA.
- Use pnpm e preserve pnpm-lock.yaml. Não use npm install no workspace.
- Antes de finalizar: pnpm lint, pnpm typecheck, pnpm test e pnpm build; corrija falhas.
- Escreva testes de comportamento para mudanças relevantes. Não simule sucesso de integrações indisponíveis.
- Use Conventional Commits; hooks executam lint-staged e commitlint.
- Não execute migrations destrutivas ou remova volumes sem autorização explícita.
