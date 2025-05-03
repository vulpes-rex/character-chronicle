
import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { LoggingModule } from '../logging/logging.module'; // Updated path
// RepositoriesModule provides repositories globally

@Module({
  imports: [LoggingModule],
  providers: [CampaignService], // Repositories injected directly into service
  exports: [CampaignService],
})
export class CampaignModule {}
