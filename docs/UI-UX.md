# UI e UX

Página mínima em português, responsiva, com diagnóstico explícito e estados aguardando, carregando, sucesso e falha.
Sem dashboard fictício. A ação é um botão acessível, com foco visível, desabilitado durante requisição e mensagem aria-live.
Layout adapta-se a telas estreitas e respeita zoom do navegador.

Tailwind 4 e tokens CSS para cores. @agro/ui contém Button no padrão shadcn/ui, com Radix Slot, CVA e cn.
apps/web/components.json configura o CLI shadcn; ao adicionar componentes, mantenha componentes reutilizáveis em packages/ui e revise os aliases gerados.
Não use fontes remotas obrigatórias. Tema, identidade visual, navegação e componentes de domínio serão definidos com produto.
