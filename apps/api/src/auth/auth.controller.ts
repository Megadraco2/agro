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
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';
import { Public } from './public.decorator';

const NOME_COOKIE = 'agro_session';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = await this.service.login(dto);
    response.cookie(NOME_COOKIE, token, {
      httpOnly: true,
      // ver nota equivalente em AdminAuthController — Secure só em produção.
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
    const token = request.cookies?.[NOME_COOKIE] as string | undefined;
    if (token) await this.service.logout(token);
    response.clearCookie(NOME_COOKIE);
  }
}
