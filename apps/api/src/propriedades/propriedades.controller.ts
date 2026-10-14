import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreatePropriedadeDto, UpdatePropriedadeDto } from './propriedades.dto';
import { PropriedadesService } from './propriedades.service';

@ApiTags('propriedades')
@Controller('propriedades')
export class PropriedadesController {
  constructor(private readonly service: PropriedadesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreatePropriedadeDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePropriedadeDto) {
    return this.service.update(id, dto);
  }
}
