
import { Module } from '@nestjs/common';
import { EncounterService } from './encounter.service';
import { LoggingModule } from '../logging/logging.module'; // Updated path
import { CampaignModule } from '../campaign/campaign.module'; // Updated path
// RepositoriesModule provides repositories globally

@Module({
  imports: [LoggingModule, CampaignModule], // Add CampaignModule
  providers: [EncounterService], // Repositories injected directly into service
  exports: [EncounterService],
})
export class EncounterModule {}
