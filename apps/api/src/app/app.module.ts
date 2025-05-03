
import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggingModule } from '../logging/logging.module';
import { RulesModule } from '../rules/rules.module';
import { FeaturesModule } from '../features/features.module';
import { DndApiModule } from '../dnd-api/dnd-api.module';
import { CharacterModule } from '../character/character.module';
import { CampaignModule } from '../campaign/campaign.module';
import { EncounterModule } from '../encounter/encounter.module';
import { UserModule } from '../user/user.module';
import { ConfigModule } from '@nestjs/config'; // Import ConfigModule

@Module({
  imports: [
    ConfigModule.forRoot({ // Add ConfigModule.forRoot()
      isGlobal: true, // Make config available globally
      envFilePath: '.env', // Specify the env file path relative to root
    }),
    LoggingModule,
    RulesModule,
    FeaturesModule,
    DndApiModule,
    CharacterModule,
    CampaignModule,
    EncounterModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
