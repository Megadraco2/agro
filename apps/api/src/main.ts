import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readEnv } from './env';
import { configureApp } from './setup';
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
