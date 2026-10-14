import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { hashSenha } from '../common/senha';
import { PrismaService } from '../prisma/prisma.service';
import { readAdminBootstrapEnv } from './bootstrap-env';

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const existentes = await this.prisma.adminSistema.count();
    if (existentes > 0) return;

    const { email, senha } = readAdminBootstrapEnv(process.env);
    if (!email || !senha) {
      throw new Error(
        'Nenhum AdminSistema existe e ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD não foram definidos — ' +
          'a aplicação não pode subir sem um jeito de logar como admin de sistema.',
      );
    }

    await this.prisma.adminSistema.create({
      data: { email, senhaHash: await hashSenha(senha) },
    });
    this.logger.log(`AdminSistema inicial criado: ${email}`);
  }
}
