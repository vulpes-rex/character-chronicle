
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // Keep auth for potential future use

// Prefix with NEXT_PUBLIC_ if you need client-side access to Firebase config
// For now, Firestore operations are server-side, so this might not be strictly necessary,
// but it's common practice if other Firebase services (like Auth UI) are used client-side.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Initialize Firebase
let app;
if (!getApps().length) {
    try {
        app = initializeApp(firebaseConfig);
    } catch (e) {
         console.error("Firebase initialization error:", e);
         // Handle initialization error appropriately
         // Maybe set a flag or throw a specific error?
         throw new Error("Could not initialize Firebase. Check configuration.");
    }
} else {
    app = getApp();
}

let db: ReturnType<typeof getFirestore> | null = null;
let authInstance: ReturnType<typeof getAuth> | null = null;

try {
    db = getFirestore(app);
    authInstance = getAuth(app); // Initialize Auth if needed later
} catch (e) {
    console.error("Error getting Firestore/Auth instance:", e);
    // Handle error getting instances if needed
}


export { app, db, authInstance as auth }; // Export potentially null db/auth if init fails
