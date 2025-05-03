import { Injectable, Inject } from '@nestjs/common';
import { Firestore, query, where } from 'firebase/firestore';
import { BaseRepository } from './base.repository';
import type { Character } from '@character-chronicle/shared/types';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class CharacterRepository extends BaseRepository<Character> {
  constructor(
    @Inject('FIRESTORE') firestore: Firestore,
    logger: LoggingService,
  ) {
    super(firestore, logger, 'characters');
  }

  async findByPlayerId(playerId: string): Promise<Character[]> {
     if (!playerId) { this.logger.warn("findByPlayerId called with empty ID."); return []; }
     return this.findAll([where('playerId', '==', playerId)]);
  }

  // Add other specific character query methods if needed
}
