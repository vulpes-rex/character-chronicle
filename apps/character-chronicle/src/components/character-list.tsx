'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Button } from '@/components/ui/button'; // Use alias
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { Skeleton } from '@/components/ui/skeleton'; // Use alias
import { useAuth } from '@/components/auth-provider'; // Use alias
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Pencil, AlertCircle, PlusCircle, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast'; // Use alias
import type { Character } from '@/lib/types'; // Use alias
import { loadAllCharactersAction, deleteCharacterAction } from '@/app/actions/character-actions'; // Use Server Actions

export function CharacterList() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchCharacters = async () => {
      if (!user) {
        // Don't fetch if user is not logged in (handled by page redirect)
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await loadAllCharactersAction(user.uid);
        if (result.success) {
          setCharacters(result.characters);
        } else {
          throw new Error(result.error || 'Failed to load characters.');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching characters.');
        console.error("Error fetching characters:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCharacters();
  }, [user]); // Refetch when user changes

  const handleDelete = async (characterId: string, characterName: string) => {
    if (!user) return; // Should not happen if user is viewing the list

    if (confirm(`Are you sure you want to delete ${characterName}? This action cannot be undone.`)) {
      try {
        const result = await deleteCharacterAction(characterId, user.uid);
        if (result.success) {
          setCharacters(prev => prev.filter(char => char.id !== characterId));
          toast({
            title: 'Character Deleted',
            description: `${characterName} has been deleted.`,
          });
        } else {
          throw new Error(result.error || 'Failed to delete character.');
        }
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: err.message || `Could not delete ${characterName}.`,
        });
        console.error("Error deleting character:", err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="p-0 relative aspect-square overflow-hidden rounded-t-lg">
                <Skeleton className="h-full w-full" />
            </CardHeader>
            <CardContent className="p-4">
              <Skeleton className="h-6 w-3/4 mb-1" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
            <CardFooter className="p-4 flex justify-end gap-2">
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-9 w-9" />
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

  if (characters.length === 0) {
    return (
       <Alert>
         <Users className="h-4 w-4" />
        <AlertTitle>No Characters Found</AlertTitle>
        <AlertDescription>
          You haven't created any characters yet.
           <Button asChild variant="link" className="p-0 h-auto ml-1">
              <Link href="/character/create">Create one now?</Link>
            </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {characters.map((character) => (
        <Card key={character.id} className="flex flex-col">
          <CardHeader className="p-0 relative aspect-square overflow-hidden rounded-t-lg">
            {/* Placeholder Image using picsum.photos */}
            <Link href={`/character/view/${character.id}`}>
              <Image
                // Use a combination of IDs or names for a more stable seed
                src={`https://picsum.photos/seed/${character.id}${character.characterName}/300/300`}
                alt={character.characterName || 'Character Portrait'}
                fill
                style={{ objectFit: 'cover' }}
                className="hover:scale-105 transition-transform duration-300"
                unoptimized // Necessary for external URLs if not configured in next.config.js
                data-ai-hint={`${character.race} ${character.class}`} // AI Hint for image generation
              />
            </Link>
          </CardHeader>
          <CardContent className="p-4 flex-grow">
            <CardTitle className="text-lg mb-1">{character.characterName}</CardTitle>
            <CardDescription>
              Level {character.level} {character.race} {character.class}
            </CardDescription>
          </CardContent>
          <CardFooter className="p-4 flex justify-end gap-2">
            <Button variant="outline" size="icon" asChild title="Edit Character">
              <Link href={`/character/edit/${character.id}`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => handleDelete(character.id, character.characterName || 'this character')}
              title="Delete Character"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

    