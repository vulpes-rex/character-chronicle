
'use client';

import { CharacterCreationWizard } from '@/components/character-creation/character-creation-wizard'; // Import the new wizard
import { AppLayout } from '@/components/app-layout';

export default function CreateCharacterPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        {/* Use the new wizard component */}
        <CharacterCreationWizard />
      </div>
    </AppLayout>
  );
}
