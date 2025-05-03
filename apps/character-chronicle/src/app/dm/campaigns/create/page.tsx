
import { AppLayout } from '@/components/app-layout'; // Use alias
import { CampaignForm } from '@/components/campaign-form'; // Use alias

// This page should likely be protected and only accessible to DMs.
// Authentication and authorization checks should be performed.

export default function CreateCampaignPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6">Create New Campaign</h1>
        {/* CampaignForm will use Server Actions for creation */}
        <CampaignForm />
      </div>
    </AppLayout>
  );
}

    