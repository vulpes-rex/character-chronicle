
'use client';

import { CharacterForm } from '@/components/character-form';
import { AppLayout } from '@/components/app-layout';

export default function CreateCharacterPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6">Create New Character</h1>
        <CharacterForm /> {/* Pass mode='create' */}
      </div>
    </AppLayout>
  );
}
