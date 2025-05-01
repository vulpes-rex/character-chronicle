
import { AppLayout } from '@/components/app-layout';
import { EncounterForm } from '@/components/encounter-form'; // New component

// This page should likely be protected and only accessible to DMs.

export default function CreateEncounterPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6">Create New Encounter</h1>
        <EncounterForm /> {/* Pass mode='create' */}
      </div>
    </AppLayout>
  );
}
