
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { LoggingModule } from '../logging/logging.module'; // Updated path
// RepositoriesModule provides repositories globally

@Module({
  imports: [LoggingModule],
  providers: [UserService], // Repositories injected directly into service
  exports: [UserService],
})
export class UserModule {}
