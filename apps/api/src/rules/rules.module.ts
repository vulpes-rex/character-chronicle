
import { Module } from '@nestjs/common';
import { RulesService } from './rules.service';
import { LoggingModule } from '../logging/logging.module'; // Updated path

@Module({
  imports: [LoggingModule], // Import LoggingModule to make LoggingService available
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
