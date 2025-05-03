
import { AppLayout } from '@/components/app-layout'; // Use alias
import { CampaignForm } from '@/components/campaign-form'; // Use alias
import { loadCampaignAction } from '@/app/actions/campaign-actions'; // Use Server Action
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { AlertCircle } from 'lucide-react';
// TODO: Import a way to get the current user ID server-side if possible

// This page should likely be protected and only accessible to the DM of the campaign.

interface EditCampaignPageProps {
  params: { id: string };
}

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
  const campaignId = params.id;
  let initialCampaignData = null;
  let errorLoading = null;
  // Placeholder for current user ID - replace with actual auth check (e.g., from server session)
  const currentUserId = "DM_USER_ID_PLACEHOLDER"; // Get this from server session/auth context

  const { success, campaign, error } = await loadCampaignAction(campaignId);

  if (!success) {
    console.error("Failed to load campaign for editing:", error);
    errorLoading = error || 'An unknown error occurred.';
  } else if (!campaign) {
    errorLoading = `Campaign with ID "${campaignId}" not found.`;
  } else {
    // Permission Check: Ensure the logged-in user is the DM
    // This check should ideally happen within the action or using middleware
    if (campaign.dmId !== currentUserId) {
        errorLoading = "Permission denied: You are not the DM of this campaign.";
        initialCampaignData = null; // Prevent passing data to form
    } else {
        initialCampaignData = campaign;
    }
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
          // CampaignForm will use Server Actions for updates
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

    