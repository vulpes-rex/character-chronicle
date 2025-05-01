
import { useState, useEffect } from 'react';
import { CharacterForm } from '@/components/character-form';
import { AppLayout } from '@/components/app-layout';
import { loadCharacter } from '@/services/character-service';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface EditCharacterPageProps {
  params: { id: string };
}

'use client';

export default  function EditCharacterPage({ params }: EditCharacterPageProps) {
  const characterId = params.id;
  const [initialCharacterData, setInitialCharacterData] = useState<any>(null);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await loadCharacter(characterId);
        setInitialCharacterData(data);
      } catch (error) {
        console.error("Failed to load character for editing:", error);
        setErrorLoading(error instanceof Error ? error.message : 'An unknown error occurred.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [characterId]);
  
  if (loading) {
      return <AppLayout>Loading...</AppLayout>
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
