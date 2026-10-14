import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminOrganizacoesService } from './admin-organizacoes.service';
import { CreateOrganizacaoDto } from './admin-sistema.dto';
import { Public } from '../auth/public.decorator';

@ApiTags('admin-organizacoes')
@Public()
@UseGuards(AdminAuthGuard)
@Controller('admin/organizacoes')
export class AdminOrganizacoesController {
  constructor(private readonly service: AdminOrganizacoesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateOrganizacaoDto) {
    return this.service.create(dto);
  }
}
