
'use client'; // Needs client-side interaction for loading state, error handling, and navigation

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // For navigation after delete
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadAllCharacters, deleteCharacter } from '@/services/character-service';
import type { Character } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Trash2, Edit, Loader2, Eye } from 'lucide-react'; // Added Eye icon

export function CharacterList() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Track which character ID is being deleted

  const { data: characters = [], isLoading, error, isError } = useQuery<Character[], Error>({
    queryKey: ['characters'],
    queryFn: loadAllCharacters,
    // staleTime: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCharacter,
    onMutate: async (characterId: string) => {
      setIsDeleting(characterId);
      // Optimistic UI update: Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['characters'] });
      // Snapshot the previous value
      const previousCharacters = queryClient.getQueryData<Character[]>(['characters']);
      // Optimistically remove the character from the list
      queryClient.setQueryData<Character[]>(['characters'], (old = []) =>
        old.filter((char) => char.id !== characterId)
      );
      // Return context with the previous data
      return { previousCharacters };
    },
    onError: (err, characterId, context) => {
      // Rollback on failure
      queryClient.setQueryData(['characters'], context?.previousCharacters);
      console.error("Deletion failed:", err);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: `Could not delete character. ${err instanceof Error ? err.message : ''}`,
      });
    },
    onSuccess: (data, characterId) => {
      toast({
        title: "Character Deleted",
        description: `Character successfully deleted.`,
      });
      // Invalidation already happened or can be triggered explicitly if needed
      // queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
    onSettled: (data, error, characterId) => {
      setIsDeleting(null); // Stop showing loading spinner for this item
       // Always refetch after error or success:
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });

  const handleDeleteClick = (characterId: string, characterName: string) => {
     // Confirmation dialog handles the actual mutation call
     console.log(`Preparing to delete ${characterName} (${characterId})`);
  };


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
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Characters</AlertTitle>
        <AlertDescription>{error?.message || 'Failed to fetch character list.'}</AlertDescription>
      </Alert>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
        <p className="text-muted-foreground mb-4">You haven't created any characters yet.</p>
        <Button asChild>
          <Link href="/character/create">Create Your First Character</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {characters.map((character) => (
        <Card key={character.id} className="flex flex-col">
          <CardHeader>
            <CardTitle>{character.characterName || 'Unnamed Character'}</CardTitle>
            <CardDescription>
              Level {character.level} {character.race} {character.class}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground truncate">
              Player: {character.playerName || 'N/A'} | Alignment: {character.alignment || 'N/A'}
            </p>
             <p className="text-sm text-muted-foreground mt-2">
                Last updated: {character.updatedAt ? character.updatedAt.toLocaleDateString() : 'N/A'}
            </p>
          </CardContent>
          <CardFooter className="flex justify-end items-center gap-2">
             {/* Changed View Button to Icon Button */}
             <Button variant="outline" size="icon" asChild className="h-8 w-8">
                <Link href={`/character/view/${character.id}`} title="View Character Sheet">
                   <Eye className="h-4 w-4" />
                </Link>
            </Button>
             <Button variant="outline" size="icon" asChild className="h-8 w-8">
               <Link href={`/character/edit/${character.id}`} title="Edit Character">
                  <Edit className="h-4 w-4" />
               </Link>
             </Button>
             <AlertDialog>
                 <AlertDialogTrigger asChild>
                      <Button
                         variant="destructive"
                         size="icon"
                         className="h-8 w-8"
                         disabled={isDeleting === character.id}
                         title="Delete Character"
                         onClick={() => handleDeleteClick(character.id, character.characterName)}
                       >
                        {isDeleting === character.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                       </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent>
                     <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                           This action cannot be undone. This will permanently delete the character
                           <strong className="px-1">{character.characterName}</strong>
                           and remove their data from our servers.
                        </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                         <AlertDialogCancel disabled={isDeleting === character.id}>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                             onClick={() => deleteMutation.mutate(character.id)}
                             disabled={isDeleting === character.id}
                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                         >
                             {isDeleting === character.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                             Delete Character
                         </AlertDialogAction>
                     </AlertDialogFooter>
                 </AlertDialogContent>
              </AlertDialog>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
