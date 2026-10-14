import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { PropriedadesController } from './propriedades.controller';
import { PropriedadesService } from './propriedades.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [PropriedadesController],
  providers: [PropriedadesService],
  exports: [PropriedadesService],
})
export class PropriedadesModule {}
