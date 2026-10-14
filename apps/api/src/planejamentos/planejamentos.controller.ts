import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListFiltersDto } from '../common/list-filters.dto';
import { CreatePlanejamentoDto } from './planejamentos.dto';
import { PlanejamentosService } from './planejamentos.service';

@ApiTags('planejamentos')
@Controller('planejamentos')
export class PlanejamentosController {
  constructor(private readonly service: PlanejamentosService) {}

  @Get()
  list(@Query() filters: ListFiltersDto) {
    return this.service.list(filters);
  }

  @Post()
  create(@Body() dto: CreatePlanejamentoDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
