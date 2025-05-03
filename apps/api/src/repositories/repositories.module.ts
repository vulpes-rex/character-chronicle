import { Module, Global } from '@nestjs/common';
import { firestoreProvider } from '../common/firestore.provider';
import { LoggingModule } from '../logging/logging.module';
import { CampaignRepository } from './campaign.repository';
import { CharacterRepository } from './character.repository';
import { EncounterRepository } from './encounter.repository';
import { GameLogRepository } from './game-log.repository';
import { SourcePackRepository } from './source-pack.repository';
import { UserRepository } from './user.repository';

@Global() // Make repositories available globally without importing RepositoriesModule everywhere
@Module({
  imports: [LoggingModule], // Needed for logger injection in repositories
  providers: [
    firestoreProvider, // Provide Firestore instance
    CampaignRepository,
    CharacterRepository,
    EncounterRepository,
    GameLogRepository,
    SourcePackRepository,
    UserRepository,
  ],
  exports: [
    // Export all repositories so other modules can inject them
    CampaignRepository,
    CharacterRepository,
    EncounterRepository,
    GameLogRepository,
    SourcePackRepository,
    UserRepository,
  ],
})
export class RepositoriesModule {}
