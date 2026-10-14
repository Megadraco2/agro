import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './admin-sistema.dto';
import { Public } from '../auth/public.decorator';

const NOME_COOKIE = 'agro_admin_session';

@ApiTags('admin-auth')
@Public()
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly service: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessaoId = await this.service.login(dto);
    response.cookie(NOME_COOKIE, sessaoId, {
      httpOnly: true,
      // secure:true exige HTTPS — em dev local (http://localhost) o
      // navegador descarta silenciosamente um cookie Secure sobre HTTP, o
      // que quebraria o login sem nenhum erro visível. Só exige HTTPS em
      // produção.
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { status: 'ok' };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessaoId = request.cookies?.[NOME_COOKIE] as string | undefined;
    if (sessaoId) await this.service.logout(sessaoId);
    response.clearCookie(NOME_COOKIE);
  }
}
