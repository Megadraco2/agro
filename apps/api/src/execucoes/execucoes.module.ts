import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { ExecucoesController } from './execucoes.controller';
import { ExecucoesService } from './execucoes.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [ExecucoesController],
  providers: [ExecucoesService],
  exports: [ExecucoesService],
})
export class ExecucoesModule {}
