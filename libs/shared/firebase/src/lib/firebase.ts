
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Ensure environment variables are prefixed correctly for the target environment
// For client-side (Next.js app), use NEXT_PUBLIC_
// For server-side (NestJS API), use regular names loaded via ConfigModule
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID, // Optional
};

// Validate config
const missingConfigKeys = Object.entries(firebaseConfig)
  .filter(([key, value]) => !value && key !== 'measurementId') // Allow measurementId to be optional
  .map(([key]) => key);

if (missingConfigKeys.length > 0) {
    console.error(`Firebase configuration is missing the following keys: ${missingConfigKeys.join(', ')}. Check your .env file.`);
    // Depending on the environment, you might throw an error or provide default values
    // throw new Error(`Missing Firebase config keys: ${missingConfigKeys.join(', ')}`);
}

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
    try {
        app = initializeApp(firebaseConfig);
        console.log("Firebase initialized successfully.");
    } catch (e) {
         console.error("Firebase initialization error:", e);
         throw new Error("Could not initialize Firebase. Check configuration.");
    }
} else {
    app = getApp();
    console.log("Firebase app already initialized.");
}

let db: Firestore | null = null;
let authInstance: Auth | null = null;

try {
    db = getFirestore(app);
} catch (e) {
    console.error("Error getting Firestore instance:", e);
}

try {
    authInstance = getAuth(app);
} catch(e) {
    console.error("Error getting Auth instance:", e);
}

export { app, db, authInstance as auth };
