
import { AppLayout } from '@/components/app-layout';
import { CharacterCreationWizard } from '@/components/character-creation/character-creation-wizard';
import { loadCharacter } from '@/services/character-service';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { Character } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/auth-provider'; // Import useAuth to check ownership

// This page should likely be protected and only accessible to the owner of the character.

interface EditCharacterPageProps {
  params: { id: string };
}


// Fetch character data server-side
async function getCharacterData(characterId: string): Promise<{ character: Character | null; error: string | null }> {
    try {
        const character = await loadCharacter(characterId);
        if (!character) {
            return { character: null, error: `Character with ID "${characterId}" not found.` };
        }
        // TODO: Add permission check here - compare character.playerId (if exists) or lookup ownership
        // const { user } = useAuth(); // Cannot use hooks in Server Components directly for auth check like this
        // Placeholder: Assume ownership check happens elsewhere or is skipped for now
        // if (character.playerId !== currentUserId) {
        //     return { character: null, error: 'You do not have permission to edit this character.' };
        // }
        return { character, error: null };
    } catch (err: any) {
        console.error(`Failed to load character ${characterId} for editing:`, err);
        return { character: null, error: err.message || 'An unknown error occurred while loading the character.' };
    }
}


export default async function EditCharacterPage({ params }: EditCharacterPageProps) {
  const characterId = params.id;
  const { character, error } = await getCharacterData(characterId);

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        {error && (
          <Alert variant="destructive" className="mb-6">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Error Loading Character</AlertTitle>
             <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {character ? (
          // Render the wizard in edit mode, passing initial data
          <CharacterCreationWizard initialData={character} editMode={true} />
        ) : (
          !error && (
            // Show loading state or a "not found" specific message if fetch returns null without error
            <Alert>
               <AlertCircle className="h-4 w-4" />
               <AlertTitle>Character Not Found</AlertTitle>
               <AlertDescription>The character with ID "{characterId}" could not be found or you don't have permission to edit it.</AlertDescription>
            </Alert>
             // Or a skeleton loader:
             // <div className="space-y-4">
             //     <Skeleton className="h-8 w-1/4" />
             //     <Skeleton className="h-4 w-full" />
             //     <Skeleton className="h-64 w-full" />
             // </div>
          )
        )}
      </div>
    </AppLayout>
  );
}
