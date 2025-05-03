
import { Module } from '@nestjs/common';
import { CharacterService } from './character.service';
import { LoggingModule } from '@/nestjs/logging/logging.module';
import { FeaturesModule } from '@/nestjs/features/features.module'; // Import FeaturesModule
import { firestoreProvider } from '@/nestjs/common/firestore.provider';

@Module({
  imports: [LoggingModule, FeaturesModule], // Add FeaturesModule
  providers: [CharacterService, firestoreProvider], // Provide Firestore instance
  exports: [CharacterService],
})
export class CharacterModule {}
