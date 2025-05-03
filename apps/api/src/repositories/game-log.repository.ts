import { Injectable, Inject } from '@nestjs/common';
import { Firestore, query, where, orderBy, limit } from 'firebase/firestore';
import { BaseRepository } from './base.repository';
import type { GameLogEntry } from '@character-chronicle/shared/types';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class GameLogRepository extends BaseRepository<GameLogEntry> {
  constructor(
    @Inject('FIRESTORE') firestore: Firestore,
    logger: LoggingService,
  ) {
    super(firestore, logger, 'gameLogs'); // Assuming collection name is 'gameLogs'
  }

  async findByCampaignId(campaignId: string, limitCount?: number): Promise<GameLogEntry[]> {
    if (!campaignId) { this.logger.warn("findByCampaignId called with empty ID."); return []; }
    const constraints = [where('campaignId', '==', campaignId), orderBy('timestamp', 'desc')];
    if (limitCount && limitCount > 0) {
      constraints.push(limit(limitCount));
    }
    const entries = await this.findAll(constraints);
    return entries.reverse(); // Return in chronological order
  }
}
