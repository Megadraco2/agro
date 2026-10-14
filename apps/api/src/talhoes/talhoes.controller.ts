import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateTalhaoDto, UpdateTalhaoDto } from './talhoes.dto';
import { TalhoesService } from './talhoes.service';

@ApiTags('talhoes')
@Controller()
export class TalhoesController {
  constructor(private readonly service: TalhoesService) {}

  @Post('propriedades/:propriedadeId/talhoes')
  create(
    @Param('propriedadeId') propriedadeId: string,
    @Body() dto: CreateTalhaoDto,
  ) {
    return this.service.create(propriedadeId, dto);
  }

  @Get('propriedades/:propriedadeId/talhoes')
  list(@Param('propriedadeId') propriedadeId: string) {
    return this.service.list(propriedadeId);
  }

  @Get('talhoes/:id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch('talhoes/:id')
  update(@Param('id') id: string, @Body() dto: UpdateTalhaoDto) {
    return this.service.update(id, dto);
  }
}
