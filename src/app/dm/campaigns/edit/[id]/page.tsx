
import { AppLayout } from '@/components/app-layout';
import { CampaignForm } from '@/components/campaign-form'; // Reusing the form component
import { loadCampaign } from '@/services/campaign-service'; // Service to load campaign data
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
// TODO: Import a way to get the current user ID server-side if possible, or handle auth client-side

// This page should likely be protected and only accessible to the DM of the campaign.

interface EditCampaignPageProps {
  params: { id: string };
}

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
  const campaignId = params.id;
  let initialCampaignData = null;
  let errorLoading = null;
  // Placeholder for current user ID - replace with actual auth check
  const currentUserId = "DM_USER_ID_PLACEHOLDER"; // Get this from server session/auth context

  try {
    initialCampaignData = await loadCampaign(campaignId);
    // Permission Check: Ensure the logged-in user is the DM
    if (initialCampaignData && initialCampaignData.dmId !== currentUserId) {
        // Throw an error or set data to null to prevent editing
        errorLoading = "Permission denied: You are not the DM of this campaign.";
        initialCampaignData = null; // Prevent passing data to form
    }
  } catch (error) {
    console.error("Failed to load campaign for editing:", error);
    errorLoading = error instanceof Error ? error.message : 'An unknown error occurred.';
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6">Edit Campaign Settings</h1>
        {errorLoading && (
          <Alert variant="destructive" className="mb-6">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Error Loading Campaign</AlertTitle>
             <AlertDescription>{errorLoading}</AlertDescription>
          </Alert>
        )}
        {initialCampaignData ? (
          <CampaignForm initialData={initialCampaignData} />
        ) : (
          !errorLoading && (
             <Alert>
               <AlertCircle className="h-4 w-4" />
               <AlertTitle>Campaign Not Found</AlertTitle>
               <AlertDescription>The campaign with ID "{campaignId}" could not be found or you don't have permission to edit it.</AlertDescription>
             </Alert>
          )
        )}
      </div>
    </AppLayout>
  );
}
