import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { ProcedimentosController } from './procedimentos.controller';
import { ProcedimentosService } from './procedimentos.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [ProcedimentosController],
  providers: [ProcedimentosService],
  exports: [ProcedimentosService],
})
export class ProcedimentosModule {}
