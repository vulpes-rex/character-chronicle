
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { LoggingModule } from '../logging/logging.module'; // Updated path
import { firestoreProvider } from '../common/firestore.provider'; // Updated path

@Module({
  imports: [LoggingModule],
  providers: [UserService, firestoreProvider], // Provide Firestore
  exports: [UserService],
})
export class UserModule {}
