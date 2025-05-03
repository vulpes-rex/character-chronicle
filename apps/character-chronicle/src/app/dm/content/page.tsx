
import { AppLayout } from '@/components/app-layout'; // Use alias
import { ContentManager } from '@/components/content-manager'; // Use alias
import { Button } from '@/components/ui/button'; // Use alias
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';

// This page should likely be protected and only accessible to DMs.
// Authentication and role checks would happen in a middleware or higher-level component.

export default function ManageContentPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Manage Content Packs</h1>
           {/* Button to create a new source pack */}
           <Button asChild>
              <Link href="/dm/content/create"> {/* Route for creating new pack */}
                 <PlusCircle className="mr-2 h-4 w-4" /> Create New Pack
              </Link>
           </Button>
        </div>
        <ContentManager /> {/* Component to list, edit, delete packs */}
      </div>
    </AppLayout>
  );
}
