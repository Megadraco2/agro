import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { InsumosModule } from './insumos/insumos.module';
import { PlanejamentosModule } from './planejamentos/planejamentos.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProcedimentosModule } from './procedimentos/procedimentos.module';
import { PropriedadesModule } from './propriedades/propriedades.module';
import { SafrasModule } from './safras/safras.module';
import { TalhoesModule } from './talhoes/talhoes.module';

@Module({
  imports: [
    PrismaModule,
    PropriedadesModule,
    TalhoesModule,
    SafrasModule,
    ProcedimentosModule,
    InsumosModule,
    PlanejamentosModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
