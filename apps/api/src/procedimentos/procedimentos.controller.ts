import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateProcedimentoDto } from './procedimentos.dto';
import { ProcedimentosService } from './procedimentos.service';

@ApiTags('procedimentos')
@Controller('procedimentos')
export class ProcedimentosController {
  constructor(private readonly service: ProcedimentosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateProcedimentoDto) {
    return this.service.create(dto);
  }
}
