
import { Module } from '@nestjs/common';
import { DndApiService } from './dnd-api.service';
import { LoggingModule } from '@/nestjs/logging/logging.module';
import { FeaturesModule } from '@/nestjs/features/features.module'; // Import FeaturesModule

@Module({
  imports: [LoggingModule, FeaturesModule], // Add FeaturesModule here
  providers: [DndApiService],
  exports: [DndApiService],
})
export class DndApiModule {}
