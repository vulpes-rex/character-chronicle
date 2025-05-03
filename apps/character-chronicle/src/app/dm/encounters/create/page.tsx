
import { AppLayout } from '@/components/app-layout'; // Use alias
import { EncounterForm } from '@/components/encounter-form'; // Use alias

// This page should likely be protected and only accessible to DMs.
// Authentication and authorization checks should be performed.

export default function CreateEncounterPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6">Create New Encounter</h1>
        {/* EncounterForm will use Server Actions for creation */}
        <EncounterForm />
      </div>
    </AppLayout>
  );
}

    