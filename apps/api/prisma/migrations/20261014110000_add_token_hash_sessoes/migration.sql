-- Até aqui o próprio id (cuid) da sessão era o token do cookie. A partir
-- desta migration o cookie carrega um token aleatório de 256 bits e o banco
-- guarda só o SHA-256 dele em "tokenHash". Sessões já existentes não têm
-- token correspondente: em vez de apagá-las, são preenchidas com um marcador
-- que nunca casa com o hash de nenhum cookie e marcadas como revogadas
-- (os usuários precisam fazer login de novo).

-- AlterTable
ALTER TABLE "SessaoAdminSistema" ADD COLUMN "tokenHash" TEXT;
UPDATE "SessaoAdminSistema" SET "tokenHash" = 'legado:' || "id", "revogadaEm" = COALESCE("revogadaEm", CURRENT_TIMESTAMP);
ALTER TABLE "SessaoAdminSistema" ALTER COLUMN "tokenHash" SET NOT NULL;

-- AlterTable
ALTER TABLE "SessaoUsuario" ADD COLUMN "tokenHash" TEXT;
UPDATE "SessaoUsuario" SET "tokenHash" = 'legado:' || "id", "revogadaEm" = COALESCE("revogadaEm", CURRENT_TIMESTAMP);
ALTER TABLE "SessaoUsuario" ALTER COLUMN "tokenHash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SessaoAdminSistema_tokenHash_key" ON "SessaoAdminSistema"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "SessaoUsuario_tokenHash_key" ON "SessaoUsuario"("tokenHash");
