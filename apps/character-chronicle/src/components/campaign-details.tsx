'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Use if needed, though campaignId comes from props
import { Button } from '@/components/ui/button'; // Use alias
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { Skeleton } from '@/components/ui/skeleton'; // Use alias
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Use alias
import { GameLog } from '@/components/game-log'; // Use alias
import { CharacterListSimple } from '@/components/character-list-simple'; // A simplified list for campaign view
import { useAuth } from '@/components/auth-provider'; // Use alias
import { Pencil, Trash2, PlusCircle, AlertCircle, Users, ScrollText } from 'lucide-react';
import Link from 'next/link';
import type { Campaign, Character, GameLogEntry } from '@/lib/types'; // Use alias
import { loadCampaignAction, loadGameLogEntriesAction, deleteCampaignAction, addPlayerToCampaignAction, removePlayerFromCampaignAction } from '@/app/actions/campaign-actions'; // Use Server Actions
import { loadAllCharactersAction } from '@/app/actions/character-actions'; // Use Server Action

interface CampaignDetailsProps {
  campaignId: string;
  mode: 'dm' | 'player'; // Determine context
}

export function CampaignDetails({ campaignId, mode }: CampaignDetailsProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [logEntries, setLogEntries] = useState<GameLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin } = useAuth(); // Get user info for permissions
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch campaign details
        const campaignResult = await loadCampaignAction(campaignId);
        if (!campaignResult.success || !campaignResult.campaign) {
          throw new Error(campaignResult.error || 'Campaign not found.');
        }
        const fetchedCampaign = campaignResult.campaign;
        setCampaign(fetchedCampaign);

        // Basic Permission Check (can be enhanced server-side in actions)
        if (!user || (mode === 'dm' && fetchedCampaign.dmId !== user.uid) || (mode === 'player' && !fetchedCampaign.playerIds.includes(user.uid) && fetchedCampaign.dmId !== user.uid)) {
            throw new Error('You do not have permission to view this campaign.');
        }

        // Fetch characters associated with the campaign
        const characterIds = fetchedCampaign.characterIds || [];
        if (characterIds.length > 0) {
           // Ideally, we'd have an action to fetch multiple characters by ID
           // For now, fetch all characters and filter (less efficient)
           const allCharsResult = await loadAllCharactersAction(user.uid); // Or fetch based on campaign ID if action supports it
           if (allCharsResult.success) {
               // Filter characters belonging to this campaign
               const campaignChars = allCharsResult.characters.filter(c => characterIds.includes(c.id));
               setCharacters(campaignChars);
           } else {
               console.warn("Could not load characters for campaign:", allCharsResult.error);
               // Decide how to handle character loading errors (e.g., show warning)
           }
        } else {
            setCharacters([]);
        }

        // Fetch game log entries
        const logResult = await loadGameLogEntriesAction(campaignId, 100); // Load last 100 entries
        if (logResult.success) {
          setLogEntries(logResult.entries);
        } else {
          console.warn("Could not load game log:", logResult.error);
          // Decide how to handle log loading errors
        }

      } catch (err: any) {
        setError(err.message || 'Failed to load campaign data.');
        console.error("Error loading campaign details:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (campaignId && user) { // Only fetch if campaignId and user are available
        fetchData();
    } else if (!user) {
        setError("You must be logged in to view campaign details.");
        setIsLoading(false);
    }

  }, [campaignId, user, mode]); // Rerun when campaignId or user changes

  const handleDeleteCampaign = async () => {
      if (!campaign || !user || !isAdmin || campaign.dmId !== user.uid) return; // Basic check

      if (confirm(`Are you sure you want to delete the campaign "${campaign.name}"? This action cannot be undone.`)) {
          const result = await deleteCampaignAction(campaign.id, user.uid);
          if (result.success) {
              router.push('/campaigns'); // Redirect after deletion
              // Optionally show a success toast
          } else {
              setError(result.error || 'Failed to delete campaign.');
              // Optionally show an error toast
          }
      }
  };

  // Placeholder functions for add/remove player - requires UI (e.g., dialog with user search)
  const handleAddPlayer = async (playerIdToAdd: string) => {
      if (!campaign || !user || !isAdmin || campaign.dmId !== user.uid) return;
      const result = await addPlayerToCampaignAction(campaign.id, playerIdToAdd, user.uid);
      if (result.success) {
          // Re-fetch campaign data or update local state
      } else {
          setError(result.error);
      }
  }
  const handleRemovePlayer = async (playerIdToRemove: string) => {
       if (!campaign || !user || !isAdmin || campaign.dmId !== user.uid) return;
       const result = await removePlayerFromCampaignAction(campaign.id, playerIdToRemove, user.uid);
        if (result.success) {
            // Re-fetch campaign data or update local state
        } else {
            setError(result.error);
        }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-4 md:p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Campaign Not Found</AlertTitle>
          <AlertDescription>The requested campaign could not be found or you don't have permission.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{campaign.name}</CardTitle>
              <CardDescription>{campaign.description || 'No description provided.'}</CardDescription>
               <p className="text-sm text-muted-foreground mt-1">DM: {campaign.dmId} {/* TODO: Fetch DM display name */}</p>
            </div>
            {mode === 'dm' && isAdmin && campaign.dmId === user?.uid && (
              <div className="flex space-x-2">
                <Button variant="outline" size="icon" asChild>
                  <Link href={`/dm/campaigns/edit/${campaign.id}`} title="Edit Campaign">
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="destructive" size="icon" onClick={handleDeleteCampaign} title="Delete Campaign">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        {/* Optional CardContent for more details like players, source packs */}
      </Card>

      <Tabs defaultValue="characters">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="characters">
              <Users className="mr-2 h-4 w-4"/> Characters ({characters.length})
          </TabsTrigger>
          <TabsTrigger value="log">
               <ScrollText className="mr-2 h-4 w-4"/> Game Log
           </TabsTrigger>
          {mode === 'dm' && isAdmin && campaign.dmId === user?.uid && (
             <TabsTrigger value="manage">
                <Users className="mr-2 h-4 w-4"/> Manage Players
             </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="characters" className="mt-4">
           <CharacterListSimple characters={characters} />
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <GameLog entries={logEntries} />
        </TabsContent>

        {mode === 'dm' && isAdmin && campaign.dmId === user?.uid && (
            <TabsContent value="manage" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Manage Players</CardTitle>
                        <CardDescription>Add or remove players from this campaign.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       {/* TODO: Implement Player Management UI */}
                       <p className="text-muted-foreground">Player management UI (add/remove) goes here.</p>
                       <ul>
                          {campaign.playerIds.map(pid => (
                              <li key={pid} className="flex justify-between items-center py-1">
                                  <span>User ID: {pid} {/* Fetch display name */}</span>
                                  <Button variant="destructive" size="sm" onClick={() => handleRemovePlayer(pid)}>Remove</Button>
                              </li>
                          ))}
                       </ul>
                       <div className="mt-4">
                           {/* Placeholder for adding a player */}
                           <Button onClick={() => alert('Add player functionality not implemented yet.')}>
                               <PlusCircle className="mr-2 h-4 w-4" /> Add Player
                           </Button>
                       </div>
                    </CardContent>
                </Card>
            </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

    