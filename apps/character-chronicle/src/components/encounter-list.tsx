'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Button } from '@/components/ui/button'; // Use alias
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { Skeleton } from '@/components/ui/skeleton'; // Use alias
import { useAuth } from '@/components/auth-provider'; // Use alias
import Link from 'next/link';
import { Pencil, Trash2, Play, Swords, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast'; // Use alias
import type { Encounter } from '@/lib/types'; // Use alias
import { loadAllEncountersAction, deleteEncounterAction } from '@/app/actions/encounter-actions'; // Use Server Actions

export function EncounterList() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchEncounters = async () => {
      if (!user || !isAdmin) {
         setIsLoading(false);
         setError("You must be logged in as a DM to view encounters.");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await loadAllEncountersAction(user.uid);
        if (result.success) {
          setEncounters(result.encounters);
        } else {
          throw new Error(result.error || 'Failed to load encounters.');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching encounters.');
        console.error("Error fetching encounters:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEncounters();
  }, [user, isAdmin]); // Rerun when user or role changes

  const handleDeleteEncounter = async (encounterId: string, encounterName: string) => {
    if (!user || !isAdmin) return;

    if (confirm(`Are you sure you want to delete the encounter "${encounterName}"? This action cannot be undone.`)) {
      try {
        const result = await deleteEncounterAction(encounterId, user.uid);
        if (result.success) {
          setEncounters(prev => prev.filter(enc => enc.id !== encounterId));
          toast({
            title: 'Encounter Deleted',
            description: `"${encounterName}" has been deleted.`,
          });
        } else {
          throw new Error(result.error || 'Failed to delete encounter.');
        }
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: err.message || `Could not delete "${encounterName}".`,
        });
        console.error("Error deleting encounter:", err);
      }
    }
  };

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
            </CardContent>
            <CardFooter className="flex justify-between">
              <Skeleton className="h-10 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-9 w-9" />
              </div>
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

  if (encounters.length === 0) {
    return (
      <Alert>
         <Swords className="h-4 w-4" />
        <AlertTitle>No Encounters Found</AlertTitle>
        <AlertDescription>
          You haven't created any encounters yet.
          <Button asChild variant="link" className="p-0 h-auto ml-1">
            <Link href="/dm/encounters/create">Create one now?</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {encounters.map((encounter) => (
        <Card key={encounter.id} className="flex flex-col">
          <CardHeader>
            <CardTitle>{encounter.name}</CardTitle>
            <CardDescription>
               Campaign: {encounter.campaignId} {/* TODO: Fetch campaign name */}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground line-clamp-3">
              {encounter.description || 'No description provided.'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
                Participants: {encounter.participants?.length || 0}
            </p>
             <p className="text-xs text-muted-foreground">
                Status: <span className="capitalize">{encounter.status || 'Setup'}</span>
             </p>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
             <Button size="sm" asChild>
                  <Link href={`/dm/encounters/run/${encounter.id}`}>
                      <Play className="mr-2 h-4 w-4"/> Run
                  </Link>
              </Button>
             <div className="flex gap-2">
                <Button variant="outline" size="icon" asChild title="Edit Encounter">
                  <Link href={`/dm/encounters/edit/${encounter.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDeleteEncounter(encounter.id, encounter.name)}
                  title="Delete Encounter"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
             </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

    