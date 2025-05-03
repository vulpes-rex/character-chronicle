'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Button } from '@/components/ui/button'; // Use alias
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { Skeleton } from '@/components/ui/skeleton'; // Use alias
import { useAuth } from '@/components/auth-provider'; // Use alias
import Link from 'next/link';
import { Pencil, Trash2, AlertCircle, Package, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast'; // Use alias
import type { SourcePack } from '@/lib/types'; // Use alias
import { loadSourcePacksByCreatorAction, deleteSourcePackAction } from '@/app/actions/campaign-actions'; // Use Server Actions

export function ContentManager() {
  const [packs, setPacks] = useState<SourcePack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchPacks = async () => {
      if (!user || !isAdmin) {
        setIsLoading(false);
        setError("You must be logged in as a DM to manage content packs.");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await loadSourcePacksByCreatorAction(user.uid);
        if (result.success) {
          // Optionally add SRD for context, though it shouldn't be editable/deletable
          const systemPack: SourcePack = { id: 'srd', name: 'System Reference Document (SRD)', creatorId: 'system', description:'Core 5e rules.', content: {}, createdAt: new Date(0), updatedAt: new Date(0) };
          setPacks([systemPack, ...result.packs]);
        } else {
          throw new Error(result.error || 'Failed to load content packs.');
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching content packs.');
        console.error("Error fetching content packs:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPacks();
  }, [user, isAdmin]); // Rerun when user or role changes

  const handleDeletePack = async (packId: string, packName: string) => {
    if (!user || !isAdmin || packId === 'srd') return; // Prevent deleting SRD

    if (confirm(`Are you sure you want to delete the content pack "${packName}"? This action cannot be undone.`)) {
      try {
        const result = await deleteSourcePackAction(packId, user.uid);
        if (result.success) {
          setPacks(prev => prev.filter(pack => pack.id !== packId));
          toast({
            title: 'Content Pack Deleted',
            description: `"${packName}" has been deleted.`,
          });
        } else {
          throw new Error(result.error || 'Failed to delete content pack.');
        }
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: err.message || `Could not delete "${packName}".`,
        });
        console.error("Error deleting content pack:", err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

   // Filter out SRD for the main list display where actions are available
   const userPacks = packs.filter(p => p.id !== 'srd');

  if (userPacks.length === 0) {
    return (
      <Alert>
         <Package className="h-4 w-4" />
        <AlertTitle>No Custom Content Packs</AlertTitle>
        <AlertDescription>
          You haven't created any custom content packs yet.
          <Button asChild variant="link" className="p-0 h-auto ml-1">
            <Link href="/dm/content/create">Create one now?</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {packs.map((pack) => (
        <Card key={pack.id}>
          <CardHeader>
            <CardTitle>{pack.name}</CardTitle>
            <CardDescription>
              {pack.creatorId === 'system' ? 'System Pack' : `Created by You`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {pack.description || 'No description provided.'}
            </p>
            {/* TODO: Optionally show counts of items/races/classes etc. */}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            {pack.creatorId !== 'system' && user?.uid === pack.creatorId && ( // Only show actions for user-created packs
               <>
                <Button variant="outline" size="icon" asChild title="Edit Pack">
                    <Link href={`/dm/content/edit/${pack.id}`}>
                        <Pencil className="h-4 w-4" />
                    </Link>
                </Button>
                <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDeletePack(pack.id, pack.name)}
                    title="Delete Pack"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
               </>
            )}
            {pack.creatorId === 'system' && (
                 <span className="text-xs text-muted-foreground italic">System pack (cannot be modified)</span>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

    