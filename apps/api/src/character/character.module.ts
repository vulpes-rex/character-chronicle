
import { Module } from '@nestjs/common';
import { CharacterService } from './character.service';
import { LoggingModule } from '../logging/logging.module'; // Updated path
import { FeaturesModule } from '../features/features.module'; // Updated path
// RepositoriesModule provides repositories globally

@Module({
  imports: [LoggingModule, FeaturesModule], // Add FeaturesModule
  providers: [CharacterService], // Repositories injected directly into service
  exports: [CharacterService],
})
export class CharacterModule {}
