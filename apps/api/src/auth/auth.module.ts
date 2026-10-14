import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUserService } from './current-user.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthGuard,
    // Registrado via APP_GUARD (não app.useGlobalGuards() em main.ts) de
    // propósito: o guard precisa valer tanto no bootstrap de produção
    // (NestFactory.create(AppModule)) quanto em todo app de teste criado a
    // partir do mesmo AppModule via Test.createTestingModule(...).compile()
    // + createNestApplication() — e só o provider token APP_GUARD, que vive
    // no grafo de DI do próprio módulo, chega às duas situações. Uma
    // chamada a app.useGlobalGuards(app.get(AuthGuard)) só afeta a
    // instância de app em que é chamada (main.ts), nunca os apps que os
    // arquivos de teste criam por conta própria.
    { provide: APP_GUARD, useExisting: AuthGuard },
    AuthService,
    CurrentUserService,
  ],
  exports: [AuthGuard, CurrentUserService],
})
export class AuthModule {}
