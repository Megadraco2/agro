# PWA

Manifesto gerado pelo App Router em /manifest.webmanifest, com id, escopo, start_url, display standalone e cores.
Ícones PNG de 192/512 px, maskable 512 px com área segura, e Apple Touch 180 px.
Ícones geométricos locais são provisórios e podem ser substituídos por identidade visual aprovada.

Service worker /sw.js é registrado somente em produção e servido sem cache HTTP.
Cache agro-static-v1 contém apenas /offline.html. Navegações same-origin usam rede e fallback quando a rede falha.
A API nunca é armazenada, inclusive se futuramente servida no mesmo domínio: somente navegações entram no handler.
Caches antigos com prefixo agro-static- são removidos na ativação; caches de outros apps são preservados.
Atualizações seguem o ciclo do navegador, sem skipWaiting forçado para evitar misturar versões.

## Verificação manual

1. Execute pnpm build e inicie web/API em terminais separados.
2. Abra localhost:3000; DevTools Application deve mostrar manifesto e worker ativado.
3. Verifique a API pelo botão. Depois desligue a API e confira a mensagem de falha.
4. Aguarde a ativação do worker, use modo offline no navegador e recarregue: a página offline deve aparecer.
5. Volte online e use “Tentar novamente”.
6. No Chromium compatível, use instalar no menu/barra. No iOS, Safari → compartilhar → adicionar à tela de início.

HTTPS é obrigatório fora de localhost. Para testar em celular na LAN, configure HTTPS confiável e uma URL de API alcançável pelo aparelho; localhost aponta ao próprio celular.
Disponibilidade da opção de instalação depende do navegador, plataforma e suas regras.

Não há dados offline, fila de operações, IndexedDB, sincronização ou push.
Antes de implementar: definir armazenamento, quotas, expiração, logout, conflitos e isolamento por usuário/organização.
