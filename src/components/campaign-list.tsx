
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { loadAllCampaigns } from '@/services/campaign-service'; // Assuming service exists
import type { Campaign } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Eye, Settings, Users } from 'lucide-react'; // Added icons

export function CampaignList() {
  const { user, userProfile, isAdmin, loading: authLoading } = useAuth();

  // Fetch campaigns - potentially filter by user ID on the backend in loadAllCampaigns
  const { data: campaigns = [], isLoading: campaignsLoading, error, isError } = useQuery<Campaign[], Error>({
    queryKey: ['campaigns', user?.uid], // Include user ID in key for potential filtering cache
    queryFn: () => loadAllCampaigns(user?.uid, userProfile?.role), // Pass user ID and role to service
    enabled: !authLoading && !!user, // Only fetch when user is loaded
  });

  const isLoading = authLoading || campaignsLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Skeleton className="h-8 w-16" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

   if (!user) {
       return (
           <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Not Logged In</AlertTitle>
              <AlertDescription>Please log in to view your campaigns.</AlertDescription>
           </Alert>
       )
   }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Campaigns</AlertTitle>
        <AlertDescription>{error?.message || 'Failed to fetch campaign list.'}</AlertDescription>
      </Alert>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
        <p className="text-muted-foreground mb-4">
            {isAdmin ? "You haven't created any campaigns yet." : "You haven't joined any campaigns yet."}
        </p>
         {isAdmin && (
             <Button asChild>
               <Link href="/dm/campaigns/create">Create Your First Campaign</Link>
             </Button>
         )}
          {!isAdmin && (
             <p className="text-sm text-muted-foreground mt-2">(Ask your DM for an invite)</p>
         )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {campaigns.map((campaign) => (
        <Card key={campaign.id} className="flex flex-col">
          <CardHeader>
            <CardTitle>{campaign.name}</CardTitle>
            <CardDescription className="truncate">{campaign.description || 'No description provided.'}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
             <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className='h-4 w-4'/> {campaign.playerIds.length} Player(s)
             </div>
             {/* Potential: Show DM name? */}
             <p className="text-xs text-muted-foreground mt-2">
                Last updated: {campaign.updatedAt instanceof Date ? campaign.updatedAt.toLocaleDateString() : 'N/A'}
            </p>
          </CardContent>
          <CardFooter className="flex justify-end items-center gap-2">
             <Button variant="outline" size="sm" asChild>
                 {/* Player view link might go to a player-specific campaign dashboard */}
                 {/* DM view link might go to a DM management dashboard */}
                 <Link href={`/campaigns/${campaign.id}/${isAdmin ? 'manage' : 'view'}`} title={isAdmin ? "Manage Campaign" : "View Campaign"}>
                    {isAdmin ? <Settings className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                    {isAdmin ? 'Manage' : 'View'}
                 </Link>
            </Button>
            {/* Add delete/edit buttons for DM if needed */}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
