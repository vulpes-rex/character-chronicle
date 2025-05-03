
import { CharacterSheet } from '@/components/character-sheet'; // Use alias
import { AppLayout } from '@/components/app-layout'; // Use alias
import { loadCharacter } from '@/services/character-service'; // Use alias
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { AlertCircle } from 'lucide-react';
import type { Character } from '@/lib/types'; // Use alias

interface ViewCharacterPageProps {
  params: { id: string };
}

// Revalidate data on demand or after a certain time if needed
// export const revalidate = 60; // Example: Revalidate every 60 seconds

export default async function ViewCharacterPage({ params }: ViewCharacterPageProps) {
  const characterId = params.id;
  let characterData: Character | null = null;
  let errorLoading: string | null = null;

  try {
    // loadCharacter is a server action, safe to call directly
    characterData = await loadCharacter(characterId);
  } catch (error) {
    console.error("Failed to load character:", error);
    errorLoading = error instanceof Error ? error.message : 'An unknown error occurred.';
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
      {errorLoading && (
        <div className="p-4 md:p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
             <AlertTitle>Error Loading Character</AlertTitle>
            <AlertDescription>{errorLoading}</AlertDescription>
          </Alert>
        </div>
      )}
      {characterData ? (
        // Pass the loaded character data to the CharacterSheet component
        // CharacterSheet is a Client Component and receives the data as props
        <CharacterSheet initialCharacter={characterData} />

      ) : (
        !errorLoading && (
          <div className="p-4 md:p-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Character Not Found</AlertTitle>
              <AlertDescription>The character with ID "{characterId}" could not be found.</AlertDescription>
            </Alert>
          </div>
        )
      )}
      </div>
    </AppLayout>
  );
}
