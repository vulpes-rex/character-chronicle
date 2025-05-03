import { Injectable, Inject } from '@nestjs/common';
import { Firestore, query, where } from 'firebase/firestore';
import { BaseRepository } from './base.repository';
import type { SourcePack } from '@character-chronicle/shared/types';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class SourcePackRepository extends BaseRepository<SourcePack> {
  constructor(
    @Inject('FIRESTORE') firestore: Firestore,
    logger: LoggingService,
  ) {
    super(firestore, logger, 'sourcePacks');
  }

  async findByCreatorId(creatorId: string): Promise<SourcePack[]> {
     if (!creatorId) { this.logger.warn("findByCreatorId called with empty ID."); return []; }
     return this.findAll([where('creatorId', '==', creatorId)]);
  }

  // Add other specific source pack query methods if needed
}
