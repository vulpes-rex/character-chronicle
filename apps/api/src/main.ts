
 /**
  * Bootstraps the NestJS application context when run directly.
  * NOTE: In the integrated setup, this file might not be executed directly.
  * The NestJS context is typically initialized on-demand by Server Actions
  * calling AppContainer.getInstance().
  */

 import { AppContainer } from './app/app-container';
 import { LoggingService } from './logging/logging.service';


 async function initializeAppContext() {
   // This function is primarily for potential standalone testing or
   // separate execution of the API context, NOT for the Next.js integration.
   try {
       console.log('Initializing NestJS Application Context (from main.ts)...');
       // This call ensures the container logic runs if main.ts is executed.
       // However, in the Next.js app, getInstance() will be called by actions.
       const appCtx = await AppContainer.getInstance();
       const logger = appCtx.get(LoggingService);
       logger.log('Application Context initialized successfully (from main.ts).', 'Bootstrap');

       // Optionally keep alive for standalone tasks, otherwise exit.
       // process.stdin.resume();

   } catch (error) {
      // Use console.error directly as logger might not be initialized
      console.error('Failed to initialize NestJS Application Context (from main.ts):', error);
      process.exit(1); // Exit if context fails to initialize in standalone mode
   }
 }

 // Check if the script is run directly (e.g., `node dist/apps/api/main.js`)
 if (require.main === module) {
    initializeAppContext();
 } else {
     console.log("main.ts loaded as a module, not bootstrapping context automatically.");
 }

 // The AppModule and AppContainer are exported implicitly via their modules.
 // No need for explicit exports here for the Next.js integration.
     