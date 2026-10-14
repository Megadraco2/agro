import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { SafrasController } from './safras.controller';
import { SafrasService } from './safras.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [SafrasController],
  providers: [SafrasService],
  exports: [SafrasService],
})
export class SafrasModule {}
