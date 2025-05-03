
import { AppLayout } from '@/components/app-layout'; // Use alias
import { EncounterList } from '@/components/encounter-list'; // Use alias
import { Button } from '@/components/ui/button'; // Use alias
import Link from 'next/link';
import { PlusCircle, Swords } from 'lucide-react';

// This page should likely be protected and only accessible to DMs.
// Authentication and role checks would happen in a middleware or higher-level component.

export default function ManageEncountersPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
             <Swords /> Manage Encounters
          </h1>
           <Button asChild>
              <Link href="/dm/encounters/create">
                 <PlusCircle className="mr-2 h-4 w-4" /> Create New Encounter
              </Link>
           </Button>
        </div>
        {/* EncounterList component will list, edit, delete encounters using Server Actions */}
        <EncounterList />
      </div>
    </AppLayout>
  );
}

    