'use client';

import Link from 'next/link';
import type { Character } from '@/lib/types'; // Use alias
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Use alias
import { Skeleton } from '@/components/ui/skeleton'; // Use alias

interface CharacterListSimpleProps {
  characters: Character[];
  isLoading?: boolean; // Optional loading state from parent
}

export function CharacterListSimple({ characters, isLoading }: CharacterListSimpleProps) {

  const getInitials = (name?: string | null): string => {
     if (!name) return '?';
     const names = name.split(' ');
     if (names.length === 1) return names[0].charAt(0).toUpperCase();
     return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  if (isLoading) {
      return (
          <ul className="space-y-3">
              {[...Array(3)].map((_, i) => (
                   <li key={i} className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                      </div>
                   </li>
              ))}
          </ul>
      );
  }

  if (!characters || characters.length === 0) {
    return <p className="text-muted-foreground">No characters found in this campaign.</p>;
  }

  return (
    <ul className="space-y-3">
      {characters.map((character) => (
        <li key={character.id}>
          <Link href={`/character/view/${character.id}`} className="block hover:bg-muted/50 rounded-lg transition-colors">
             <Card className="flex items-center space-x-3 p-3 cursor-pointer shadow-sm hover:shadow-md">
               {/* Basic Avatar Placeholder */}
               <Avatar className="h-10 w-10">
                  {/* Add AvatarImage if you store character images */}
                  {/* <AvatarImage src={character.imageUrl} alt={character.characterName} /> */}
                  <AvatarFallback>{getInitials(character.characterName)}</AvatarFallback>
               </Avatar>
               <div>
                 <p className="font-medium">{character.characterName}</p>
                 <p className="text-sm text-muted-foreground">
                   Level {character.level} {character.race} {character.class}
                 </p>
               </div>
             </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

    