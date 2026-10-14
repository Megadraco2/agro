import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { InsumosController } from './insumos.controller';
import { InsumosService } from './insumos.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [InsumosController],
  providers: [InsumosService],
  exports: [InsumosService],
})
export class InsumosModule {}
