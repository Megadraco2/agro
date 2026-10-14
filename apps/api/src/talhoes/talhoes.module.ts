import { Module } from '@nestjs/common';
import { TalhoesController } from './talhoes.controller';
import { TalhoesService } from './talhoes.service';

@Module({
  controllers: [TalhoesController],
  providers: [TalhoesService],
  exports: [TalhoesService],
})
export class TalhoesModule {}
