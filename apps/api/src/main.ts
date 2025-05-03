
/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';
import { LoggingService } from './logging/logging.service';

async function bootstrap() {
  // Use createApplicationContext for background tasks/services if no HTTP server needed initially
  // const app = await NestFactory.createApplicationContext(AppModule);

  // Use create for a full HTTP application
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until custom logger is attached
  });

  // Use custom logger
  app.useLogger(app.get(LoggingService));

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Configure CORS if the Next.js app will run on a different origin in development/production
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:9002', // Allow requests from Next.js app origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });


  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
