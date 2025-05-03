
import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { LoggingModule } from '@/nestjs/logging/logging.module';
import { firestoreProvider } from '@/nestjs/common/firestore.provider';

@Module({
  imports: [LoggingModule],
  providers: [CampaignService, firestoreProvider], // Provide Firestore instance
  exports: [CampaignService],
})
export class CampaignModule {}
