import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@agro/contracts';
class HealthDto implements HealthResponse {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status!: 'ok';
}
@ApiTags('health')
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
