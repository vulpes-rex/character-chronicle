
import { Module } from '@nestjs/common';
import { EncounterService } from './encounter.service';
import { LoggingModule } from '../logging/logging.module'; // Updated path
import { CampaignModule } from '../campaign/campaign.module'; // Updated path
import { firestoreProvider } from '../common/firestore.provider'; // Updated path

@Module({
  imports: [LoggingModule, CampaignModule], // Add CampaignModule
  providers: [EncounterService, firestoreProvider], // Provide Firestore instance
  exports: [EncounterService],
})
export class EncounterModule {}
