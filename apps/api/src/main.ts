
/**
 * Bootstraps the NestJS application.
 * This can run as a full HTTP server or just initialize the application context
 * for use by Server Actions or background tasks.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { LoggingService } from './logging/logging.service';
import { AppContainer } from './app/app-container'; // Import AppContainer

async function bootstrap() {
  // Option 1: Initialize only the Application Context (for Server Actions)
  // This prevents starting an HTTP listener but makes services available via the container.
  try {
      console.log('Bootstrapping NestJS Application Context...');
      const appCtx = await AppContainer.getInstance();
      const logger = appCtx.get(LoggingService);
      logger.log('Application Context bootstrapped successfully. Ready for service access.', 'Bootstrap');

      // Keep the process alive if needed for background tasks, or exit if just for one-off init.
      // For Server Actions, the context will be kept alive by the Next.js server process.
      // process.stdin.resume(); // Example: Keep alive

      // You might not need to run appCtx.close() here if the container manages its lifecycle

  } catch (error) {
     console.error('Failed to bootstrap NestJS Application Context:', error);
     process.exit(1); // Exit if context fails to initialize
  }


  // Option 2: Run as a full HTTP Server (if you also need direct API endpoints)
  /*
  try {
      console.log('Bootstrapping NestJS HTTP Server...');
      const app = await NestFactory.create(AppModule, {
          bufferLogs: true,
      });

      // Use custom logger
      app.useLogger(app.get(LoggingService));
      const logger = app.get(LoggingService);

      const globalPrefix = 'api';
      app.setGlobalPrefix(globalPrefix);

      // Configure CORS if the Next.js app runs on a different origin
      const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:9002'; // Default to Next.js dev server port
      app.enableCors({
          origin: corsOrigin,
          methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
          credentials: true,
      });
      logger.log(`CORS enabled for origin: ${corsOrigin}`, 'Bootstrap');

      const port = process.env.PORT || 3000;
      await app.listen(port);
      logger.log(`🚀 API application is running on: http://localhost:${port}/${globalPrefix}`, 'Bootstrap');

      // Initialize the AppContainer instance if the app starts successfully
      // This might be redundant if getInstance() is called elsewhere first
      // await AppContainer.getInstance();


  } catch (error) {
       console.error('Failed to bootstrap NestJS HTTP Server:', error);
       process.exit(1);
  }
  */
}

bootstrap();

    