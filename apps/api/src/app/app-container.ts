
import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { NestFactory, type INestApplicationContext } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class AppContainer implements OnModuleInit, OnModuleDestroy {
    private static instance: INestApplicationContext | null = null;
    private static isInitializing = false;
    private static initializationPromise: Promise<INestApplicationContext> | null = null;

    constructor(
        // Inject Logger if needed within the container itself, though likely not necessary
        // private readonly logger: LoggingService
    ) {}

    async onModuleInit() {
        // Optionally perform actions when the container itself is initialized within a running app
        // This might not be called when using createApplicationContext directly
        console.log('AppContainer initialized within a running Nest application.');
        // Initialize instance here if running as a full app
        if (!AppContainer.instance) {
            // await AppContainer.getInstance(); // Avoid recursive call if possible
        }
    }

    async onModuleDestroy() {
        console.log('Closing NestJS application context...');
        await AppContainer.closeInstance();
    }

    public static async getInstance(): Promise<INestApplicationContext> {
        if (this.instance) {
            return this.instance;
        }

        if (this.isInitializing && this.initializationPromise) {
             console.log("NestJS application context is already initializing, waiting...");
            // Wait for the ongoing initialization to complete
            return this.initializationPromise;
        }

        console.log("AppContainer.getInstance() called, initializing NestJS application context...");
        this.isInitializing = true;
        this.initializationPromise = (async () => {
            try {
                 console.log("NestFactory.createApplicationContext starting...");
                 // Use createApplicationContext for a DI container without running an HTTP server
                 const app = await NestFactory.createApplicationContext(AppModule, {
                     // Buffer logs until the custom logger is ready
                      bufferLogs: true,
                 });
                 console.log("NestFactory.createApplicationContext finished.");

                 // Use the custom LoggingService
                 const logger = app.get(LoggingService);
                 app.useLogger(logger); // Apply the custom logger
                 logger.setContext('AppContainer'); // Set context for logger

                 logger.log('NestJS application context initialized successfully.');
                 this.instance = app;
                 this.isInitializing = false;
                 this.initializationPromise = null; // Clear promise after success
                 return app;
            } catch (error) {
                 // Log detailed error during initialization
                 console.error("FATAL: Failed to initialize NestJS application context in AppContainer.getInstance()", error);
                 if (error instanceof Error) {
                     console.error("Error Name:", error.name);
                     console.error("Error Message:", error.message);
                     console.error("Error Stack:", error.stack);
                 }
                 // Attempt to use LoggingService if available, otherwise fallback to console
                 try {
                     const logger = this.instance?.get(LoggingService) ?? new LoggingService();
                     logger.error("Failed to initialize NestJS application context", error instanceof Error ? error.stack : undefined, 'AppContainer', { errorDetails: error });
                 } catch (loggingError) {
                     console.error("Secondary error: Could not use LoggingService to log the initialization error.", loggingError);
                 }

                 this.isInitializing = false;
                 this.initializationPromise = null; // Clear promise after failure
                 // Consider how to handle this error. Throwing might prevent Server Actions from working.
                 // Re-throwing ensures the calling Server Action fails clearly.
                 throw new Error(`Failed to initialize backend services: ${error instanceof Error ? error.message : String(error)}`);
            }
        })();

        return this.initializationPromise;
    }

    public static async closeInstance(): Promise<void> {
        if (this.instance) {
            console.log('Closing NestJS application context instance...');
            await this.instance.close();
            this.instance = null;
             console.log('NestJS application context instance closed.');
        }
         this.isInitializing = false;
         this.initializationPromise = null;
    }
}

    