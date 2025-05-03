
import { AppLayout } from '@/components/app-layout'; // Use alias
import { ContentPackForm } from '@/components/content-pack-form'; // Use alias

// This page should likely be protected and only accessible to DMs.
// Authentication and authorization checks should be performed.

export default function CreateContentPackPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6">Create New Content Pack</h1>
        {/* ContentPackForm will use Server Actions for creation */}
        <ContentPackForm />
      </div>
    </AppLayout>
  );
}

    