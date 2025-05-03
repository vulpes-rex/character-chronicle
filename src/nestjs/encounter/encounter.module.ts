
import { Module } from '@nestjs/common';
import { EncounterService } from './encounter.service';
import { LoggingModule } from '@/nestjs/logging/logging.module';
import { CampaignModule } from '@/nestjs/campaign/campaign.module'; // Import CampaignModule
import { firestoreProvider } from '@/nestjs/common/firestore.provider';

@Module({
  imports: [LoggingModule, CampaignModule], // Add CampaignModule
  providers: [EncounterService, firestoreProvider], // Provide Firestore instance
  exports: [EncounterService],
})
export class EncounterModule {}
