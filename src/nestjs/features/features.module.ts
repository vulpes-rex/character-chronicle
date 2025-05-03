
import { Module } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { LoggingModule } from '@/nestjs/logging/logging.module';
import { RulesModule } from '@/nestjs/rules/rules.module'; // Import RulesModule

@Module({
  imports: [LoggingModule, RulesModule], // Add RulesModule here
  providers: [FeaturesService],
  exports: [FeaturesService],
})
export class FeaturesModule {}
