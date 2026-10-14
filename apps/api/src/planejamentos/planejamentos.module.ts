import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { PlanejamentosController } from './planejamentos.controller';
import { PlanejamentosService } from './planejamentos.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [PlanejamentosController],
  providers: [PlanejamentosService],
  exports: [PlanejamentosService],
})
export class PlanejamentosModule {}
