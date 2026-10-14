import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateSafraDto, UpdateSafraDto } from './safras.dto';
import { SafrasService } from './safras.service';

@ApiTags('safras')
@Controller('safras')
export class SafrasController {
  constructor(private readonly service: SafrasService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateSafraDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSafraDto) {
    return this.service.update(id, dto);
  }
}
