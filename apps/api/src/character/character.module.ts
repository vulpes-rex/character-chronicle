
import { Module } from '@nestjs/common';
import { CharacterService } from './character.service';
import { LoggingModule } from '../logging/logging.module'; // Updated path
import { FeaturesModule } from '../features/features.module'; // Updated path
import { firestoreProvider } from '../common/firestore.provider'; // Updated path

@Module({
  imports: [LoggingModule, FeaturesModule], // Add FeaturesModule
  providers: [CharacterService, firestoreProvider], // Provide Firestore instance
  exports: [CharacterService],
})
export class CharacterModule {}
