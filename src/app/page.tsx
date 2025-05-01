'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { CharacterList } from '@/components/character-list';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, Loader2 } from 'lucide-react'; // Added Loader2

export default function Home() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect once auth state is confirmed (loading is false)
    if (!loading) {
      if (!user) {
        // Redirect to login if not authenticated
        router.replace('/login');
      } else if (userProfile?.role === 'dm') {
        // Redirect DMs to the campaigns page
        router.replace('/campaigns');
      }
      // Players remain on this page (My Characters)
    }
  }, [user, userProfile, loading, router]);

  // Show loading indicator while checking auth/role or if redirecting
  if (loading || (!user && !loading) || (user && !userProfile && !loading) || (userProfile?.role === 'dm' && !loading)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
           <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Render character list for players only
  return (
    <AppLayout>
        <div className="p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">My Characters</h1>
                <Button asChild>
                    <Link href="/character/create">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create New Character
                    </Link>
                </Button>
            </div>
            <CharacterList />
        </div>
    </AppLayout>
  );
}
