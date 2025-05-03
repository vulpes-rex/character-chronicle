
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { INestApplicationContext } from '@nestjs/common';
import { LoggingService } from './logging/logging.service';

/**
 * Singleton container for the NestJS application context.
 * This allows Server Actions to access NestJS services.
 */
export class AppContainer {
  private static instance: INestApplicationContext | null = null;
  private static isInitializing = false;
  private static initializationPromise: Promise<INestApplicationContext> | null = null;

  /**
   * Gets the singleton instance of the NestJS application context.
   * Initializes the application if it hasn't been initialized yet.
   */
  public static async getInstance(): Promise<INestApplicationContext> {
    if (this.instance) {
      return this.instance;
    }

    if (this.isInitializing && this.initializationPromise) {
        // If initialization is already in progress, wait for it to complete
        return this.initializationPromise;
    }

    this.isInitializing = true;
    this.initializationPromise = new Promise(async (resolve, reject) => {
        try {
            console.log('Initializing NestJS application context...');
            // Disable NestJS default logger or use a custom logger that integrates better
            const app = await NestFactory.createApplicationContext(AppModule, {
                 logger: false // Using our custom logger below
                 // logger: ['error', 'warn'], // Or configure specific levels
            });

            // Use our custom logging service for NestJS internal logs if desired
            // const logger = app.get(LoggingService);
            // app.useLogger(logger);

            console.log('NestJS application context initialized successfully.');
            this.instance = app;
            this.isInitializing = false;
            this.initializationPromise = null; // Clear promise after success
            resolve(app);
        } catch (error) {
            console.error('Failed to initialize NestJS application context:', error);
            this.isInitializing = false;
            this.initializationPromise = null; // Clear promise on error
            reject(error);
        }
    });
    return this.initializationPromise;
  }

  /**
   * Closes the NestJS application context.
   * Should be called during application shutdown if necessary.
   */
  public static async closeInstance(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
      console.log('NestJS application context closed.');
    }
  }
}

// Optional: Graceful shutdown handling (might not be suitable for all serverless environments)
// process.on('SIGTERM', async () => {
//   console.log('Received SIGTERM, closing NestJS context...');
//   await AppContainer.closeInstance();
//   process.exit(0);
// });
// process.on('SIGINT', async () => {
//   console.log('Received SIGINT, closing NestJS context...');
//   await AppContainer.closeInstance();
//   process.exit(0);
// });
