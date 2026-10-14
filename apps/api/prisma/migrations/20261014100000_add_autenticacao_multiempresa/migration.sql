-- AlterTable
ALTER TABLE "Organizacao" ADD COLUMN "maxUsuarios" INTEGER NOT NULL DEFAULT 5;

-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('ORG_ADMIN', 'ORG_MEMBER');

-- CreateTable
CREATE TABLE "AdminSistema" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoAdminSistema" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoAdminSistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminSistema_email_key" ON "AdminSistema"("email");

-- CreateIndex
CREATE INDEX "SessaoAdminSistema_adminId_idx" ON "SessaoAdminSistema"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_organizacaoId_idx" ON "Usuario"("organizacaoId");

-- CreateIndex
CREATE INDEX "SessaoUsuario_usuarioId_idx" ON "SessaoUsuario"("usuarioId");

-- AddForeignKey
ALTER TABLE "SessaoAdminSistema" ADD CONSTRAINT "SessaoAdminSistema_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminSistema"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoUsuario" ADD CONSTRAINT "SessaoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
