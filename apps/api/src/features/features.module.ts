
import { Module } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { LoggingModule } from '../logging/logging.module'; // Updated path
import { RulesModule } from '../rules/rules.module'; // Updated path

@Module({
  imports: [LoggingModule, RulesModule], // Add RulesModule here
  providers: [FeaturesService],
  exports: [FeaturesService],
})
export class FeaturesModule {}
