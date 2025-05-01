
'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Assuming your firebase config is here
import { loadUserProfile, createUserProfile } from '@/services/user-service';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean; // Convenience flag for DM role
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        // Load or create user profile
        let profile = await loadUserProfile(firebaseUser.uid);
        if (!profile) {
           // Create a default profile (e.g., as 'player') if it doesn't exist
           profile = await createUserProfile({
              id: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0], // Default display name
              role: 'player', // Default to player
           });
        }
        setUserProfile(profile);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const isAdmin = userProfile?.role === 'dm';

  const value = { user, userProfile, loading, isAdmin };

  // Show loading state while auth is initializing
  // if (loading) {
  //    return <AuthLoadingScreen />;
  // }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


// Optional: Simple loading screen component
function AuthLoadingScreen() {
  return (
     <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 p-8 rounded-lg shadow-lg bg-card">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
            <Skeleton className="h-10 w-32 mx-auto mt-4" />
        </div>
     </div>
  );
}
