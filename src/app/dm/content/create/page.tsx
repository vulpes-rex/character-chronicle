
import { AppLayout } from '@/components/app-layout';
import { ContentPackForm } from '@/components/content-pack-form'; // New component

// This page should likely be protected and only accessible to DMs.

export default function CreateContentPackPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6">Create New Content Pack</h1>
        {/* Pass mode='create' or handle creation logic within the form */}
        <ContentPackForm />
      </div>
    </AppLayout>
  );
}
