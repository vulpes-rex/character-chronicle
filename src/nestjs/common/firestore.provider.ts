
import { db } from '@/lib/firebase'; // Import the initialized db instance
import { type Firestore } from 'firebase/firestore';

// This is a simple provider pattern, not a full NestJS provider with injection.
// It ensures we use the same initialized Firestore instance.
export const firestoreProvider = {
  provide: 'FIRESTORE',
  useValue: db,
};

// Export the db instance directly if needed by services outside full NestJS DI
export const getFirestoreInstance = (): Firestore => {
  if (!db) {
    throw new Error("Firestore has not been initialized. Check firebase.ts");
  }
  return db;
};
