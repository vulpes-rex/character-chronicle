
import { AppLayout } from '@/components/app-layout'; // Use alias
import { ContentPackForm } from '@/components/content-pack-form'; // Use alias
import { loadSourcePackAction } from '@/app/actions/campaign-actions'; // Use Server Action
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { AlertCircle } from 'lucide-react';

// This page should likely be protected and only accessible to the DM who owns the pack.

interface EditContentPackPageProps {
  params: { id: string };
}

export default async function EditContentPackPage({ params }: EditContentPackPageProps) {
  const packId = params.id;
  let initialPackData = null;
  let errorLoading = null;
  // Placeholder for current user ID - replace with actual auth check
  const currentUserId = "DM_USER_ID_PLACEHOLDER"; // Get this from server session/auth context

  const { success, pack, error } = await loadSourcePackAction(packId);

  if (!success) {
    console.error("Failed to load source pack for editing:", error);
    errorLoading = error || 'An unknown error occurred.';
  } else if (!pack) {
    errorLoading = `Content pack with ID "${packId}" not found.`;
  } else {
      // TODO: Add permission check here - ensure the logged-in user is the creatorId
      if (pack.creatorId !== currentUserId && pack.creatorId !== 'system') {
           errorLoading = "Permission denied: You did not create this content pack.";
           initialPackData = null;
      } else {
          initialPackData = pack;
      }
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6">Edit Content Pack</h1>
        {errorLoading && (
          <Alert variant="destructive" className="mb-6">
             <AlertCircle className="h-4 w-4" />
             <AlertTitle>Error Loading Pack</AlertTitle>
             <AlertDescription>{errorLoading}</AlertDescription>
          </Alert>
        )}
        {initialPackData ? (
          // ContentPackForm will use Server Actions for updates
          <ContentPackForm initialData={initialPackData} />
        ) : (
          !errorLoading && (
             <Alert>
               <AlertCircle className="h-4 w-4" />
               <AlertTitle>Content Pack Not Found</AlertTitle>
               <AlertDescription>The content pack with ID "{packId}" could not be found or you don't have permission to edit it.</AlertDescription>
             </Alert>
          )
        )}
      </div>
    </AppLayout>
  );
}

    