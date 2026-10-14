import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateInsumoDto, UpdateInsumoPrecoDto } from './insumos.dto';
import { InsumosService } from './insumos.service';

@ApiTags('insumos')
@Controller('insumos')
export class InsumosController {
  constructor(private readonly service: InsumosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateInsumoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  updatePreco(@Param('id') id: string, @Body() dto: UpdateInsumoPrecoDto) {
    return this.service.updatePreco(id, dto);
  }
}
