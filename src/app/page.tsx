
import { CharacterList } from '@/components/character-list';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';

export default function Home() {
  return (
    <AppLayout>
        <div className="p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">My Characters</h1>
                <Button asChild>
                    <Link href="/character/create">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create New Character
                    </Link>
                </Button>
            </div>
            <CharacterList />
        </div>
      {/* Old CharacterSheet removed, will be loaded via /character/[id] route now */}
      {/* <CharacterSheet /> */}
    </AppLayout>
  );
}
