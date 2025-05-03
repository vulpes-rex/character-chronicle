
import { AppLayout } from '@/components/app-layout'; // Use alias
import { CharacterCreationWizard } from '@/components/character-creation/character-creation-wizard'; // Use alias
import { loadCharacterAction } from '@/app/actions/character-actions'; // Use Server Action
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { AlertCircle } from 'lucide-react';
import type { Character } from '@/lib/types'; // Use alias
// import { useAuth } from '@/components/auth-provider'; // Auth check should happen server-side or via action

// This page should likely be protected and only accessible to the owner of the character.

interface EditCharacterPageProps {
  params: { id: string };
}


// Fetch character data server-side using Server Action
async function getCharacterData(characterId: string): Promise<{ character: Character | null; error: string | null }> {
    const { success, character, error } = await loadCharacterAction(characterId);
    if (!success) {
        console.error(`Failed to load character ${characterId} for editing:`, error);
        return { character: null, error: error || 'An unknown error occurred while loading the character.' };
    }
    if (!character) {
         return { character: null, error: `Character with ID "${characterId}" not found.` };
    }

    // TODO: Implement proper permission check server-side (e.g., using user session)
    // Placeholder: Assume action handles permission or check here if possible
    // const serverSession = await getServerSession(); // Example: Get session
    // if (!serverSession || character.playerId !== serverSession.user.id) {
    //     return { character: null, error: 'You do not have permission to edit this character.' };
    // }

    return { character, error: null };
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
            // Show "not found" specific message if fetch returns null without error
            <Alert>
               <AlertCircle className="h-4 w-4" />
               <AlertTitle>Character Not Found</AlertTitle>
               <AlertDescription>The character with ID "{characterId}" could not be found or you don't have permission to edit it.</AlertDescription>
            </Alert>
          )
        )}
      </div>
    </AppLayout>
  );
}

    