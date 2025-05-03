
import { Module } from '@nestjs/common';
import { DndApiService } from './dnd-api.service';
import { LoggingModule } from '../logging/logging.module'; // Updated path
import { FeaturesModule } from '../features/features.module'; // Updated path

@Module({
  imports: [LoggingModule, FeaturesModule], // Add FeaturesModule here
  providers: [DndApiService],
  exports: [DndApiService],
})
export class DndApiModule {}
