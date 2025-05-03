
import { Module } from '@nestjs/common';
import { LoggingModule } from './logging/logging.module';
import { RulesModule } from './rules/rules.module';
import { FeaturesModule } from './features/features.module';
import { DndApiModule } from './dnd-api/dnd-api.module';
import { CharacterModule } from './character/character.module';
import { CampaignModule } from './campaign/campaign.module';
import { EncounterModule } from './encounter/encounter.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    LoggingModule,
    RulesModule,
    FeaturesModule,
    DndApiModule,
    CharacterModule,
    CampaignModule,
    EncounterModule,
    UserModule,
    // Add other feature modules here
  ],
  controllers: [], // Add controllers if you expose HTTP endpoints via NestJS
  providers: [],
})
export class AppModule {}
