import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { PropriedadesModule } from './propriedades/propriedades.module';
import { TalhoesModule } from './talhoes/talhoes.module';

@Module({
  imports: [PrismaModule, PropriedadesModule, TalhoesModule],
  controllers: [HealthController],
})
export class AppModule {}
