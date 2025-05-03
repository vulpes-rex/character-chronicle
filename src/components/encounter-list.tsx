
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadAllEncounters, deleteEncounter } from '@/services/encounter-service'; // Assuming services exist
import type { Encounter } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Edit, Trash2, Loader2, Play, PlusCircle, Users, Swords } from 'lucide-react';

export function EncounterList() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Fetch encounters created by the current DM
  const { data: encounters = [], isLoading: encountersLoading, error, isError } = useQuery<Encounter[], Error>({
    queryKey: ['encounters', user?.uid], // Key includes user ID for DM-specific fetching
    queryFn: () => loadAllEncounters(user!.uid), // Fetch encounters for the logged-in DM
    enabled: !authLoading && !!user && isAdmin, // Only fetch if user is loaded and is a DM
  });

  const deleteMutation = useMutation({
    mutationFn: (encounterId: string) => deleteEncounter(encounterId, user!.uid), // Pass DM ID for permission check
    onMutate: async (encounterId: string) => {
      setIsDeleting(encounterId);
      await queryClient.cancelQueries({ queryKey: ['encounters', user?.uid] });
      const previousEncounters = queryClient.getQueryData<Encounter[]>(['encounters', user?.uid]);
      queryClient.setQueryData<Encounter[]>(['encounters', user?.uid], (old = []) =>
        old.filter((enc) => enc.id !== encounterId)
      );
      return { previousEncounters };
    },
    onError: (err, encounterId, context) => {
      queryClient.setQueryData(['encounters', user?.uid], context?.previousEncounters);
      console.error("Deletion failed:", err);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: `Could not delete encounter. ${err instanceof Error ? err.message : ''}`,
      });
    },
    onSuccess: () => {
      toast({
        title: "Encounter Deleted",
        description: `Encounter successfully deleted.`,
      });
    },
    onSettled: () => {
      setIsDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['encounters', user?.uid] });
    },
  });

  const isLoading = authLoading || encountersLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader>
            <CardContent><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-5/6" /></CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-16" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (!isAdmin) {
     return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>You do not have permission to manage encounters.</AlertDescription>
        </Alert>
     );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Encounters</AlertTitle>
        <AlertDescription>{error?.message || 'Failed to fetch encounters.'}</AlertDescription>
      </Alert>
    );
  }

  if (encounters.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
        <p className="text-muted-foreground mb-4">You haven't created any encounters yet.</p>
        <Button asChild>
          <Link href="/dm/encounters/create"> <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Encounter</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {encounters.map((encounter) => (
        <Card key={encounter.id} className="flex flex-col">
          <CardHeader>
            <CardTitle>{encounter.name}</CardTitle>
            <CardDescription className="line-clamp-2">{encounter.description || 'No description.'}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
             <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className='h-4 w-4'/> {encounter.participants.length} Participant(s)
             </div>
             <p className="text-xs text-muted-foreground mt-2">
                 Campaign ID: {encounter.campaignId.substring(0, 8)}... {/* Maybe show campaign name? */}
            </p>
             <p className="text-xs text-muted-foreground mt-1">
                Last updated: {encounter.updatedAt instanceof Date ? encounter.updatedAt.toLocaleDateString() : 'N/A'}
            </p>
          </CardContent>
          <CardFooter className="flex justify-end items-center gap-2">
             <Button variant="outline" size="icon" asChild className="h-8 w-8">
               <Link href={`/dm/encounters/edit/${encounter.id}`} title="Edit Encounter">
                  <Edit className="h-4 w-4" />
               </Link>
             </Button>
             <AlertDialog>
                 <AlertDialogTrigger asChild>
                      <Button
                         variant="destructive"
                         size="icon"
                         className="h-8 w-8"
                         disabled={isDeleting === encounter.id}
                         title="Delete Encounter"
                       >
                        {isDeleting === encounter.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                       </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent>
                     <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                           This action cannot be undone. This will permanently delete the encounter
                           <strong className="px-1">{encounter.name}</strong>.
                        </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                         <AlertDialogCancel disabled={isDeleting === encounter.id}>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                             onClick={() => deleteMutation.mutate(encounter.id)}
                             disabled={isDeleting === encounter.id}
                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                         >
                             {isDeleting === encounter.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                             Delete Encounter
                         </AlertDialogAction>
                     </AlertDialogFooter>
                 </AlertDialogContent>
              </AlertDialog>
               <Button size="sm" asChild>
                 <Link href={`/dm/encounters/run/${encounter.id}`} title="Run Encounter">
                     <Play className="mr-2 h-4 w-4" /> Run
                 </Link>
               </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
