
// This file can now be simplified or removed if all Firebase interactions
// are handled through the shared library or specific service files.

// Re-export from the shared library for convenience if needed by client components.
export { app, db, auth } from '@character-chronicle/shared/firebase';
