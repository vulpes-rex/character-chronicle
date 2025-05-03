import { Injectable, Inject } from '@nestjs/common';
import { Firestore, query, where } from 'firebase/firestore';
import { BaseRepository } from './base.repository';
import type { Encounter } from '@character-chronicle/shared/types';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class EncounterRepository extends BaseRepository<Encounter> {
  constructor(
    @Inject('FIRESTORE') firestore: Firestore,
    logger: LoggingService,
  ) {
    super(firestore, logger, 'encounters');
  }

  async findByCampaignIds(campaignIds: string[]): Promise<Encounter[]> {
     if (!campaignIds || campaignIds.length === 0) return [];
     if (campaignIds.length > 30) {
        this.logger.warn(`Querying encounters for >30 campaign IDs. Firestore 'in' query limit is 30. Slicing.`);
        campaignIds = campaignIds.slice(0, 30);
     }
     return this.findAll([where('campaignId', 'in', campaignIds)]);
  }

  // Add other specific encounter query methods if needed
}
