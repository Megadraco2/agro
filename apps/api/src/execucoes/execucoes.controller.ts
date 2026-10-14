import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListFiltersDto } from '../common/list-filters.dto';
import { CreateExecucaoDto } from './execucoes.dto';
import { ExecucoesService } from './execucoes.service';

@ApiTags('execucoes')
@Controller('execucoes')
export class ExecucoesController {
  constructor(private readonly service: ExecucoesService) {}

  @Get()
  list(@Query() filters: ListFiltersDto) {
    return this.service.list(filters);
  }

  @Post()
  create(@Body() dto: CreateExecucaoDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
