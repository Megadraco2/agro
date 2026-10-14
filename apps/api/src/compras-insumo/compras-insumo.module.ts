import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { ComprasInsumoController } from './compras-insumo.controller';
import { ComprasInsumoService } from './compras-insumo.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [ComprasInsumoController],
  providers: [ComprasInsumoService],
  exports: [ComprasInsumoService],
})
export class ComprasInsumoModule {}
