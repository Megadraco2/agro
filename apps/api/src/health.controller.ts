import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@agro/contracts';
import { Public } from './auth/public.decorator';
class HealthDto implements HealthResponse {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';
}
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    type: HealthDto,
    description: 'API em execução; não verifica o banco.',
  })
  health(): HealthResponse {
    return { status: 'ok' };
  }
}
