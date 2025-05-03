
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // Import ConfigModule
import { LoggingModule } from '../logging/logging.module';
import { RulesModule } from '../rules/rules.module';
import { FeaturesModule } from '../features/features.module';
import { DndApiModule } from '../dnd-api/dnd-api.module';
import { CharacterModule } from '../character/character.module';
import { CampaignModule } from '../campaign/campaign.module';
import { EncounterModule } from '../encounter/encounter.module';
import { UserModule } from '../user/user.module';
import { AppContainer } from './app-container'; // Import the container
import { RepositoriesModule } from '../repositories/repositories.module'; // Import the RepositoriesModule

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make config available globally
      envFilePath: ['.env.local', '.env'], // Specify env file paths
      cache: true, // Enable caching
    }),
    // Core Application Modules
    RepositoriesModule, // Import the RepositoriesModule (provides repositories globally)
    LoggingModule,
    RulesModule,
    FeaturesModule,
    DndApiModule,
    CharacterModule,
    CampaignModule,
    EncounterModule,
    UserModule,
  ],
  providers: [AppContainer], // Provide the AppContainer
  exports: [AppContainer], // Export if needed elsewhere (though usually accessed via getInstance)
  // No controllers needed at the root level anymore
})
export class AppModule {}

    