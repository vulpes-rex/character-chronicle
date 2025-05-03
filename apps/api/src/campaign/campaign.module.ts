
import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { LoggingModule } from '../logging/logging.module'; // Updated path
import { firestoreProvider } from '../common/firestore.provider'; // Updated path

@Module({
  imports: [LoggingModule],
  providers: [CampaignService, firestoreProvider], // Provide Firestore instance
  exports: [CampaignService],
})
export class CampaignModule {}
