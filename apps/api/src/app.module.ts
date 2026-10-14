import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminSistemaModule } from './admin-sistema/admin-sistema.module';
import { AuthModule } from './auth/auth.module';
import { ComprasInsumoModule } from './compras-insumo/compras-insumo.module';
import { ExecucoesModule } from './execucoes/execucoes.module';
import { HealthController } from './health.controller';
import { InsumosModule } from './insumos/insumos.module';
import { PlanejamentosModule } from './planejamentos/planejamentos.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProcedimentosModule } from './procedimentos/procedimentos.module';
import { PropriedadesModule } from './propriedades/propriedades.module';
import { SafrasModule } from './safras/safras.module';
import { TalhoesModule } from './talhoes/talhoes.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 5 }],
    }),
    PrismaModule,
    PropriedadesModule,
    TalhoesModule,
    SafrasModule,
    ProcedimentosModule,
    InsumosModule,
    PlanejamentosModule,
    ExecucoesModule,
    ComprasInsumoModule,
    AdminSistemaModule,
    AuthModule,
    UsuariosModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
