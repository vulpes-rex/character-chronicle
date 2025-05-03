
import { Module } from '@nestjs/common';
import { RulesService } from './rules.service';
import { LoggingModule } from '@/nestjs/logging/logging.module';

@Module({
  imports: [LoggingModule], // Import LoggingModule to make LoggingService available
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
