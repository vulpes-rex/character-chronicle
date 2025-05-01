
import { AppLayout } from '@/components/app-layout';
import { EncounterForm } from '@/components/encounter-form'; // Reusing form
import { loadEncounter } from '@/services/encounter-service'; // New service function
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

// This page should likely be protected and only accessible to the DM of the campaign associated with the encounter.

interface EditEncounterPageProps {
  params: { id: string };
}

export default async function EditEncounterPage({ params }: EditEncounterPageProps) {
  const encounterId = params.id;
  let initialEncounterData = null;
  let errorLoading = null;
  // TODO: Add permission checks based on campaign DM ID

  try {
    initialEncounterData = await loadEncounter(encounterId);
    // TODO: Add permission check here - ensure the logged-in user is the DM of the campaign (initialEncounterData.campaignId)
  } catch (error) {
    console.error("Failed to load encounter for editing:", error);
    errorLoading = error instanceof Error ? error.message : 'An unknown error occurred.';
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6">Edit Encounter</h1>
        {errorLoading && (
          <Alert variant="destructive" className="mb-6">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Error Loading Encounter</AlertTitle>
             <AlertDescription>{errorLoading}</AlertDescription>
          </Alert>
        )}
        {initialEncounterData ? (
          <EncounterForm initialData={initialEncounterData} />
        ) : (
          !errorLoading && (
             <Alert>
               <AlertCircle className="h-4 w-4" />
               <AlertTitle>Encounter Not Found</AlertTitle>
               <AlertDescription>The encounter with ID "{encounterId}" could not be found or you don't have permission to edit it.</AlertDescription>
             </Alert>
          )
        )}
      </div>
    </AppLayout>
  );
}
