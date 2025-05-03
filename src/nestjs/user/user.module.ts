
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { LoggingModule } from '@/nestjs/logging/logging.module';
import { firestoreProvider } from '@/nestjs/common/firestore.provider';

@Module({
  imports: [LoggingModule],
  providers: [UserService, firestoreProvider], // Provide Firestore
  exports: [UserService],
})
export class UserModule {}
