import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

// Task 11.13's real-device follow-up finding: Express's default JSON body limit is 100kb.
// /sync/batch's offline-queue flush (SyncContext.tsx on both web and mobile) can legitimately
// exceed that once enough changes queue up while offline for a while (confirmed on-device: a
// real flush hit 352kb and got rejected with a 413, which then permanently stuck the device in
// "showing cached data" -- the same oversized payload just failed identically on every retry).
// 10mb is generous headroom for a single batch of JSON change records, not a config to fine-tune.
const JSON_BODY_LIMIT = '10mb';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.enableCors({ origin: true });
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  setupSwagger(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Calendar API listening on http://localhost:${port}`);
  console.log(`API docs at http://localhost:${port}/docs`);
}

bootstrap();
