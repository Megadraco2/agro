import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readEnv } from './env';
import { configureApp } from './setup';
// AuthGuard é aplicado globalmente via provider APP_GUARD em AuthModule
// (não app.useGlobalGuards() aqui) — ver comentário em
// src/auth/auth.module.ts para o porquê: só assim o guard também vale nos
// apps que os testes criam diretamente a partir de AppModule.
async function bootstrap() {
  const env = readEnv(process.env);
  const app = await NestFactory.create(AppModule);
  // Rate limiting (ThrottlerGuard) precisa do IP real do cliente, não do
  // ingress do Kubernetes que fica na frente do pod em produção — sem isso,
  // req.ip reportaria sempre o IP do ingress e todos os usuários cairiam no
  // mesmo balde de 5 logins/min. "1" = confia em 1 hop de proxy reverso.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  configureApp(app, env.CORS_ORIGIN);
  await app.listen(env.PORT, '0.0.0.0');
}
void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
