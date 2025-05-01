
import { AppLayout } from '@/components/app-layout';
import { ContentPackForm } from '@/components/content-pack-form'; // Reusing the form component
import { loadSourcePack } from '@/services/campaign-service'; // Service to load pack data
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

// This page should likely be protected and only accessible to the DM who owns the pack.

interface EditContentPackPageProps {
  params: { id: string };
}

export default async function EditContentPackPage({ params }: EditContentPackPageProps) {
  const packId = params.id;
  let initialPackData = null;
  let errorLoading = null;

  try {
    initialPackData = await loadSourcePack(packId);
    // TODO: Add permission check here - ensure the logged-in user is the creatorId
  } catch (error) {
    console.error("Failed to load source pack for editing:", error);
    errorLoading = error instanceof Error ? error.message : 'An unknown error occurred.';
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
