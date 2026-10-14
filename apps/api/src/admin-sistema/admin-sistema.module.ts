import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminOrganizacoesController } from './admin-organizacoes.controller';
import { AdminOrganizacoesService } from './admin-organizacoes.service';

@Module({
  controllers: [AdminAuthController, AdminOrganizacoesController],
  providers: [
    AdminBootstrapService,
    AdminAuthGuard,
    AdminAuthService,
    AdminOrganizacoesService,
  ],
})
export class AdminSistemaModule {}
