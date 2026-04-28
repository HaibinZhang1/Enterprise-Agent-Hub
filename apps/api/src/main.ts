import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { logInfo } from './common/structured-log';
import { AppModule } from './app.module';
import { P1HttpExceptionFilter } from './common/http-error.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new P1HttpExceptionFilter());
  app.enableCors({ origin: true, credentials: true });
  const port = Number(process.env.API_PORT ?? '3000');
  await app.listen(port, '0.0.0.0');
  logInfo({
    event: 'api.started',
    domain: 'runtime',
    action: 'bootstrap',
    result: 'ok',
    detail: { port },
  });
}

void bootstrap();
