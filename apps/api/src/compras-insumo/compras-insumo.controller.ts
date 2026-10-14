import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListFiltersDto } from '../common/list-filters.dto';
import { ComprasInsumoService } from './compras-insumo.service';
import { CreateCompraInsumoDto } from './compras-insumo.dto';

@ApiTags('compras-insumo')
@Controller('compras-insumo')
export class ComprasInsumoController {
  constructor(private readonly service: ComprasInsumoService) {}

  @Get()
  list(@Query() filters: ListFiltersDto) {
    return this.service.list(filters);
  }

  @Post()
  create(@Body() dto: CreateCompraInsumoDto) {
    return this.service.create(dto);
  }
}
