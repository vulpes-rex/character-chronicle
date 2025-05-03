import { Injectable, Inject } from '@nestjs/common';
import { Firestore } from 'firebase/firestore';
import { BaseRepository } from './base.repository';
import type { UserProfile } from '@character-chronicle/shared/types';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class UserRepository extends BaseRepository<UserProfile> {
  constructor(
    @Inject('FIRESTORE') firestore: Firestore,
    logger: LoggingService,
  ) {
    super(firestore, logger, 'users');
  }

  // User profiles are usually accessed by ID (which is the Firebase UID),
  // so findById from BaseRepository is often sufficient.
  // Add specific user query methods if needed (e.g., findByEmail - though generally discouraged for privacy)
}
