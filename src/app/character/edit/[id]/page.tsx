
import { CharacterForm } from '@/components/character-form';
import { AppLayout } from '@/components/app-layout';
import { loadCharacter } from '@/services/character-service';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface EditCharacterPageProps {
  params: { id: string };
}

export default async function EditCharacterPage({ params }: EditCharacterPageProps) {
  const characterId = params.id;
  let initialCharacterData = null;
  let errorLoading = null;

  try {
    initialCharacterData = await loadCharacter(characterId);
  } catch (error) {
    console.error("Failed to load character for editing:", error);
    errorLoading = error instanceof Error ? error.message : 'An unknown error occurred.';
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6">Edit Character</h1>
        {errorLoading && (
          <Alert variant="destructive" className="mb-6">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Error Loading Character</AlertTitle>
             <AlertDescription>{errorLoading}</AlertDescription>
          </Alert>
        )}
        {initialCharacterData ? (
          <CharacterForm initialData={initialCharacterData} /> {/* Pass mode='edit' and initial data */}
        ) : (
          !errorLoading && (
             <Alert>
               <AlertCircle className="h-4 w-4" />
               <AlertTitle>Character Not Found</AlertTitle>
               <AlertDescription>The character with ID "{characterId}" could not be found.</AlertDescription>
             </Alert>
          )
        )}
      </div>
    </AppLayout>
  );
}
