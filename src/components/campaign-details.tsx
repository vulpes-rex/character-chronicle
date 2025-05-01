
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadCampaign, loadGameLogEntries, addGameLogEntry, addPlayerToCampaign, removePlayerFromCampaign, updateCampaign } from '@/services/campaign-service';
import { loadAllCharacters } from '@/services/character-service'; // To load characters in campaign
import type { Campaign, Character, GameLogEntry } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Eye, Trash2, UserPlus, Send, Loader2, Settings } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { formatDistanceToNow } from 'date-fns'; // For relative time formatting


interface CampaignDetailsProps {
    campaignId: string;
    mode: 'player' | 'dm'; // Controls whether DM options are shown
}

export function CampaignDetails({ campaignId, mode }: CampaignDetailsProps) {
    const { user, userProfile, isAdmin, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [newLogMessage, setNewLogMessage] = useState('');
    const [isSendingLog, setIsSendingLog] = useState(false);
    const [inviteEmail, setInviteEmail] = useState(''); // State for inviting players (future feature)
    const [isInviting, setIsInviting] = useState(false);


    // Fetch Campaign Data
    const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery<Campaign | null, Error>({
        queryKey: ['campaign', campaignId],
        queryFn: () => loadCampaign(campaignId),
        enabled: !!campaignId,
    });

    // Fetch Characters in the Campaign
    const { data: characters = [], isLoading: charactersLoading } = useQuery<Character[], Error>({
        queryKey: ['characters', 'campaign', campaignId],
        // TODO: Modify loadAllCharacters or create a new service function
        //       to filter characters by campaign.characterIds
        queryFn: async () => {
           if (!campaign?.characterIds || campaign.characterIds.length === 0) return [];
           // Placeholder: Inefficiently load all, then filter. Needs optimization.
           const allChars = await loadAllCharacters();
           return allChars.filter(char => campaign.characterIds.includes(char.id));
        },
        enabled: !!campaign && campaign.characterIds && campaign.characterIds.length > 0,
    });


    // Fetch Game Log Entries
    const { data: logEntries = [], isLoading: logLoading, refetch: refetchLogs } = useQuery<GameLogEntry[], Error>({
        queryKey: ['gameLog', campaignId],
        queryFn: () => loadGameLogEntries(campaignId, 50), // Load last 50 entries
        enabled: !!campaignId,
        // Optional: Refetch logs periodically or use real-time listeners
        // refetchInterval: 30000, // Refetch every 30 seconds
    });


     // Add Log Entry Mutation
     const addLogMutation = useMutation({
         mutationFn: (entryData: Omit<GameLogEntry, 'id' | 'timestamp' | 'campaignId'>) =>
            addGameLogEntry({ ...entryData, campaignId }),
         onSuccess: () => {
             toast({ title: 'Log Entry Added' });
             setNewLogMessage(''); // Clear input
             queryClient.invalidateQueries({ queryKey: ['gameLog', campaignId] }); // Refetch logs
         },
         onError: (error) => {
             toast({ variant: 'destructive', title: 'Error', description: `Failed to add log entry: ${error.message}` });
         },
         onSettled: () => {
             setIsSendingLog(false);
         },
     });


    // Derived state and loading management
    const isLoading = authLoading || campaignLoading || charactersLoading || logLoading;
    const isUserDm = mode === 'dm' && isAdmin && campaign?.dmId === user?.uid;

    // Permission check after loading
    useEffect(() => {
        if (!isLoading && campaign) {
            const isPlayerInCampaign = campaign.playerIds.includes(user?.uid ?? '');
            if (!isUserDm && !isPlayerInCampaign) {
                toast({ variant: 'destructive', title: 'Access Denied', description: 'You are not part of this campaign.' });
                // Consider redirecting: router.push('/campaigns');
            }
        }
    }, [isLoading, campaign, user, isUserDm, toast]);


    const handleAddLogEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLogMessage.trim() || !user || !userProfile) return;

        setIsSendingLog(true);
        addLogMutation.mutate({
            actorId: user.uid,
            actorName: userProfile.displayName || 'User',
            actionType: isUserDm ? 'dm-message' : 'player-message',
            details: newLogMessage.trim(),
        });
    };


    // --- DM Actions (Placeholder Implementations) ---
    const handleInvitePlayer = async () => {
        if (!inviteEmail || !isUserDm || !user?.uid) return;
        setIsInviting(true);
        toast({ title: 'Invite Sent (Simulated)', description: `Invitation sent to ${inviteEmail}.`});
        // TODO: Implement actual invite logic (e.g., find user by email, call addPlayerToCampaign)
        // try {
        //    Find user ID by email (requires a separate service/function)
        //    await addPlayerToCampaign(campaignId, foundPlayerId, user.uid);
        //    toast({ title: 'Player Added', description: `${inviteEmail} added to the campaign.` });
        //    setInviteEmail('');
        //    queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] }); // Refresh campaign data
        // } catch (error) {
        //    toast({ variant: 'destructive', title: 'Invite Failed', description: error.message });
        // } finally {
        //    setIsInviting(false);
        // }
        setInviteEmail('');
        setIsInviting(false); // Remove simulation delay later
    };

    const handleRemovePlayer = async (playerId: string) => {
       if (!isUserDm || !user?.uid) return;
       // Confirmation dialog is recommended here
       try {
           await removePlayerFromCampaign(campaignId, playerId, user.uid);
           toast({ title: 'Player Removed', description: 'Player removed from campaign.'});
           queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
           queryClient.invalidateQueries({ queryKey: ['users', 'campaign', campaignId] }); // If fetching player profiles
       } catch (error: any) {
            toast({ variant: 'destructive', title: 'Remove Failed', description: error.message });
       }
    };


    // --- Render ---

    if (isLoading) {
        return <CampaignDetailsSkeleton />;
    }

    if (campaignError) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Campaign</AlertTitle>
                    <AlertDescription>{campaignError.message}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!campaign) {
         return (
            <div className="p-6">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Campaign Not Found</AlertTitle>
                    <AlertDescription>The requested campaign could not be found.</AlertDescription>
                </Alert>
            </div>
         );
    }

    // Basic permission check display (won't render content if checks in useEffect redirect)
    const isPlayerInCampaign = campaign.playerIds.includes(user?.uid ?? '');
     if (!isUserDm && !isPlayerInCampaign && !authLoading) {
          return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>You do not have permission to view this campaign.</AlertDescription>
                </Alert>
            </div>
        );
     }


    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Campaign Header */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <div>
                           <CardTitle className="text-2xl">{campaign.name}</CardTitle>
                           <CardDescription>{campaign.description || 'No description.'}</CardDescription>
                        </div>
                        {isUserDm && (
                             <Button size="sm" variant="outline" asChild>
                                <Link href={`/dm/campaigns/edit/${campaignId}`}> {/* Link to DM edit page */}
                                    <Settings className='mr-2 h-4 w-4'/> Manage Settings
                                </Link>
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                     <p className="text-xs text-muted-foreground">DM: {campaign.dmId /* Replace with DM name lookup */} | Players: {campaign.playerIds.length}</p>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Characters & Players Section */}
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                         <CardHeader><CardTitle>Characters</CardTitle></CardHeader>
                         <CardContent>
                             {charactersLoading ? (
                                 <Skeleton className="h-20 w-full" />
                             ) : characters.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No characters in this campaign yet.</p>
                             ) : (
                                <ul className="space-y-2">
                                     {characters.map(char => (
                                         <li key={char.id} className="flex justify-between items-center text-sm p-2 rounded hover:bg-muted/50">
                                             <span>{char.characterName} ({char.playerName}) - Lvl {char.level} {char.race} {char.class}</span>
                                             <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                                                 {/* DM sees read-only, Player sees their own sheet */}
                                                 <Link href={`/character/view/${char.id}`} title="View Character Sheet">
                                                     <Eye className="h-4 w-4" />
                                                 </Link>
                                             </Button>
                                         </li>
                                     ))}
                                </ul>
                             )}
                         </CardContent>
                    </Card>

                    {isUserDm && (
                        <Card>
                           <CardHeader><CardTitle>Manage Players</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                {/* TODO: List current players with remove button */}
                                <ul className="space-y-2 max-h-40 overflow-y-auto">
                                   {/* Placeholder: Fetch and list player profiles */}
                                   {campaign.playerIds.map(playerId => (
                                       <li key={playerId} className="flex justify-between items-center text-sm">
                                          <span>Player ID: {playerId.substring(0,8)}...</span> {/* Replace with actual name lookup */}
                                          <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" onClick={() => handleRemovePlayer(playerId)}>
                                              <Trash2 className="h-3 w-3 mr-1"/> Remove
                                          </Button>
                                      </li>
                                   ))}
                                   {campaign.playerIds.length === 0 && <p className='text-xs text-muted-foreground'>No players added yet.</p>}
                               </ul>
                               <div className="flex gap-2 pt-3 border-t">
                                    <Input
                                        type="email"
                                        placeholder="Invite player by email..."
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        disabled={isInviting}
                                        className="h-9"
                                    />
                                    <Button size="sm" onClick={handleInvitePlayer} disabled={!inviteEmail || isInviting}>
                                         {isInviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                         Invite
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                 {/* Game Log Section */}
                <div className="lg:col-span-2">
                   <Card className="flex flex-col h-full">
                       <CardHeader><CardTitle>Game Log</CardTitle></CardHeader>
                       <CardContent className="flex-grow flex flex-col gap-4 overflow-hidden">
                           <ScrollArea className="flex-grow h-0 border rounded-md p-3 bg-muted/30">
                             {logLoading && !logEntries.length ? (
                                 <Skeleton className="h-full w-full" />
                              ) : logEntries.length === 0 ? (
                                  <p className="text-sm text-muted-foreground text-center py-4">Log is empty. Start playing!</p>
                              ) : (
                                 <div className="space-y-2 text-sm">
                                     {logEntries.map(entry => (
                                         <div key={entry.id} className="flex gap-2 items-start">
                                             <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 w-16 text-right" title={new Date(entry.timestamp).toLocaleString()}>
                                                {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                                             </span>
                                             <span className="font-medium w-24 truncate" title={entry.actorName}>{entry.actorName}:</span>
                                             <p className="flex-1 text-foreground/90 break-words">{entry.details}</p>
                                         </div>
                                     ))}
                                 </div>
                             )}
                          </ScrollArea>
                          {/* Log Input Form */}
                           <form onSubmit={handleAddLogEntry} className="flex gap-2 pt-4 border-t">
                               <Input
                                    placeholder="Type a message or action..."
                                    value={newLogMessage}
                                    onChange={(e) => setNewLogMessage(e.target.value)}
                                    disabled={isSendingLog}
                                />
                               <Button type="submit" disabled={!newLogMessage.trim() || isSendingLog}>
                                   {isSendingLog ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Send
                               </Button>
                           </form>
                       </CardContent>
                   </Card>
                </div>
            </div>
        </div>
    );
}


function CampaignDetailsSkeleton() {
  return (
     <div className="p-4 md:p-6 space-y-6">
        <Card>
            <CardHeader><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
            <CardContent><Skeleton className="h-4 w-1/4" /></CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
                <Card>
                    <CardHeader><CardTitle><Skeleton className='h-6 w-32'/></CardTitle></CardHeader>
                    <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                </Card>
                 {/* Skeleton for DM player management */}
                 <Card>
                    <CardHeader><CardTitle><Skeleton className='h-6 w-40'/></CardTitle></CardHeader>
                    <CardContent><Skeleton className="h-24 w-full" /></CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                <Card className="h-[500px]"> {/* Approx height */}
                    <CardHeader><CardTitle><Skeleton className='h-6 w-24'/></CardTitle></CardHeader>
                    <CardContent className='h-full flex flex-col'><Skeleton className="h-full w-full" /></CardContent>
                </Card>
            </div>
        </div>
     </div>
  )
}
