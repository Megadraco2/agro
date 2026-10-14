import { Module } from '@nestjs/common';
import { OrganizacaoModule } from '../organizacao/organizacao.module';
import { TalhoesController } from './talhoes.controller';
import { TalhoesService } from './talhoes.service';

@Module({
  imports: [OrganizacaoModule],
  controllers: [TalhoesController],
  providers: [TalhoesService],
  exports: [TalhoesService],
})
export class TalhoesModule {}
