import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { PropriedadesModule } from './propriedades/propriedades.module';

@Module({
  imports: [PrismaModule, PropriedadesModule],
  controllers: [HealthController],
})
export class AppModule {}
