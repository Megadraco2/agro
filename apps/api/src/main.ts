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
  configureApp(app, env.CORS_ORIGIN);
  await app.listen(env.PORT, '0.0.0.0');
}
void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
