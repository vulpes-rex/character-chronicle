
import { AppLayout } from '@/components/app-layout'; // Use alias
import { EncounterForm } from '@/components/encounter-form'; // Use alias
import { loadEncounterAction } from '@/app/actions/encounter-actions'; // Use Server Action
import { loadCampaignAction } from '@/app/actions/campaign-actions'; // Need campaign for permission check
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { AlertCircle } from 'lucide-react';

// This page should likely be protected and only accessible to the DM of the campaign associated with the encounter.

interface EditEncounterPageProps {
  params: { id: string };
}

export default async function EditEncounterPage({ params }: EditEncounterPageProps) {
  const encounterId = params.id;
  let initialEncounterData = null;
  let errorLoading = null;
  // Placeholder for current user ID - replace with actual auth check
  const currentUserId = "DM_USER_ID_PLACEHOLDER"; // Get this from server session/auth context

  const encounterResult = await loadEncounterAction(encounterId);

  if (!encounterResult.success) {
      console.error("Failed to load encounter for editing:", encounterResult.error);
      errorLoading = encounterResult.error || 'An unknown error occurred.';
  } else if (!encounterResult.encounter) {
      errorLoading = `Encounter with ID "${encounterId}" not found.`;
  } else {
      initialEncounterData = encounterResult.encounter;

      // Fetch campaign to check DM permission
      const campaignResult = await loadCampaignAction(initialEncounterData.campaignId);
      if (!campaignResult.success || !campaignResult.campaign) {
          errorLoading = `Failed to load campaign ${initialEncounterData.campaignId} for permission check.`;
          initialEncounterData = null; // Prevent editing if campaign cannot be verified
      } else if (campaignResult.campaign.dmId !== currentUserId) {
          errorLoading = "Permission denied: You are not the DM of this encounter's campaign.";
          initialEncounterData = null; // Prevent editing
      }
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
          // EncounterForm will use Server Actions for updates
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

    