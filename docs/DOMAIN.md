# Domínio

Domínio de Gestão Agrícola implementado: Propriedade, Talhão, Safra, Procedimento, Insumo, Planejamento, Execução e Compra de Insumo.
Glossário completo, regras e relacionamentos: docs/superpowers/specs/2026-10-13-gestao-agricola-dominio-design.md.
Organização segue como tema de descoberta além do isolamento multi-tenant já aplicado por organizacaoId.

`Usuario`, `AdminSistema`, `SessaoUsuario` e `SessaoAdminSistema` são modelos de identidade e
acesso (quem pode logar, com qual sessão, em qual papel) — não fazem parte do domínio de Gestão
Agrícola em si, que continua sendo só as 8 entidades acima. Ver docs/AUTH.md para a autenticação e
docs/DATABASE.md para o esquema dessas tabelas.

Próxima etapa: expandir o domínio conforme novos processos reais sejam mapeados.
