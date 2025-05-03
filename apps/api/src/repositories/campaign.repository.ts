import { Injectable, Inject } from '@nestjs/common';
import { Firestore } from 'firebase/firestore';
import { BaseRepository } from './base.repository';
import type { Campaign } from '@character-chronicle/shared/types';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class CampaignRepository extends BaseRepository<Campaign> {
  constructor(
    @Inject('FIRESTORE') firestore: Firestore,
    logger: LoggingService,
  ) {
    super(firestore, logger, 'campaigns');
  }

  // Add specific campaign query methods if needed
  // e.g., findByDmId(dmId: string): Promise<Campaign[]>
}
