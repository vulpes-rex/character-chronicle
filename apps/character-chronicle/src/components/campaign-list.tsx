'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Button } from '@/components/ui/button'; // Use alias
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { Skeleton } from '@/components/ui/skeleton'; // Use alias
import { useAuth } from '@/components/auth-provider'; // Use alias
import Link from 'next/link';
import { ShieldCheck, Users, AlertCircle } from 'lucide-react';
import type { Campaign } from '@/lib/types'; // Use alias
import { loadAllCampaignsAction } from '@/app/actions/campaign-actions'; // Use Server Action

export function CampaignList() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin } = useAuth(); // Get user and role

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!user) {
        setIsLoading(false);
        setError("Please log in to view campaigns.");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await loadAllCampaignsAction(user.uid, isAdmin ? 'dm' : 'player');
        if (result.success) {
          setCampaigns(result.campaigns);
        } else {
          throw new Error(result.error || 'Failed to load campaigns.');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching campaigns.');
        console.error("Error fetching campaigns:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [user, isAdmin]); // Rerun when user or role changes

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full mt-2" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-24" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Alert>
         <Users className="h-4 w-4" />
        <AlertTitle>No Campaigns Found</AlertTitle>
        <AlertDescription>
          {isAdmin
            ? "You haven't created or joined any campaigns yet."
            : "You haven't joined any campaigns yet."}
          {isAdmin && (
            <Button asChild variant="link" className="p-0 h-auto ml-1">
              <Link href="/dm/campaigns/create">Create one now?</Link>
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((campaign) => (
        <Card key={campaign.id}>
          <CardHeader>
            <CardTitle>{campaign.name}</CardTitle>
            <CardDescription>
              {campaign.dmId === user?.uid ? (
                <span className="flex items-center text-xs text-muted-foreground">
                  <ShieldCheck className="mr-1 h-3 w-3 text-primary" /> You are the DM
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">DM: {campaign.dmId /* TODO: Fetch DM name */}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {campaign.description || 'No description provided.'}
            </p>
             <p className="text-xs text-muted-foreground mt-2">
                Players: {campaign.playerIds?.length || 0}
             </p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href={`/campaigns/${campaign.id}/${campaign.dmId === user?.uid ? 'manage' : 'view'}`}>
                {campaign.dmId === user?.uid ? 'Manage' : 'View'} Campaign
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

    