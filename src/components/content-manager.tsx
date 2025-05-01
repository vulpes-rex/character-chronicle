
'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadSourcePacksByCreator, deleteSourcePack } from '@/services/campaign-service'; // Assuming services exist
import type { SourcePack } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Edit, Trash2, Loader2, PlusCircle } from 'lucide-react';

export function ContentManager() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Track which pack ID is being deleted

  // Fetch source packs created by the current user (DM)
  const { data: sourcePacks = [], isLoading: packsLoading, error, isError } = useQuery<SourcePack[], Error>({
    queryKey: ['sourcePacks', user?.uid], // Key includes user ID
    queryFn: () => loadSourcePacksByCreator(user!.uid), // Fetch packs for the logged-in user
    enabled: !authLoading && !!user && isAdmin, // Only fetch if user is loaded and is a DM
  });

  const deleteMutation = useMutation({
    mutationFn: (packId: string) => deleteSourcePack(packId, user!.uid), // Pass user ID for permission check
    onMutate: async (packId: string) => {
      setIsDeleting(packId);
      await queryClient.cancelQueries({ queryKey: ['sourcePacks', user?.uid] });
      const previousPacks = queryClient.getQueryData<SourcePack[]>(['sourcePacks', user?.uid]);
      queryClient.setQueryData<SourcePack[]>(['sourcePacks', user?.uid], (old = []) =>
        old.filter((pack) => pack.id !== packId)
      );
      return { previousPacks };
    },
    onError: (err, packId, context) => {
      queryClient.setQueryData(['sourcePacks', user?.uid], context?.previousPacks);
      console.error("Deletion failed:", err);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: `Could not delete source pack. ${err instanceof Error ? err.message : ''}`,
      });
    },
    onSuccess: () => {
      toast({
        title: "Source Pack Deleted",
        description: `Pack successfully deleted.`,
      });
    },
    onSettled: () => {
      setIsDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['sourcePacks', user?.uid] });
    },
  });

  const isLoading = authLoading || packsLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-4 w-5/6" /></CardContent>
            <CardFooter className="flex justify-end gap-2"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (!isAdmin) {
     return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>You do not have permission to manage content packs.</AlertDescription>
        </Alert>
     );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Content</AlertTitle>
        <AlertDescription>{error?.message || 'Failed to fetch source packs.'}</AlertDescription>
      </Alert>
    );
  }

  if (sourcePacks.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg">
        <p className="text-muted-foreground mb-4">You haven't created any content packs yet.</p>
        <Button asChild>
          <Link href="/dm/content/create"> <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Pack</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sourcePacks.map((pack) => (
        <Card key={pack.id} className="flex flex-col">
          <CardHeader>
            <CardTitle>{pack.name}</CardTitle>
            <CardDescription className="line-clamp-2">{pack.description || 'No description.'}</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-xs text-muted-foreground">Contains:
               {Object.keys(pack.content.races || {}).length} Races,{' '}
               {Object.keys(pack.content.classes || {}).length} Classes,{' '}
               {Object.keys(pack.content.items || {}).length} Items,{' '}
               {Object.keys(pack.content.monsters || {}).length} Monsters,{' '} {/* Added monster count */}
               {Object.keys(pack.content.backgrounds || {}).length} Backgrounds
            </p>
             <p className="text-xs text-muted-foreground mt-1">
                Last updated: {pack.updatedAt ? new Date(pack.updatedAt).toLocaleDateString() : 'N/A'}
            </p>
          </CardContent>
          <CardFooter className="flex justify-end items-center gap-2">
             <Button variant="outline" size="icon" asChild className="h-8 w-8">
               <Link href={`/dm/content/edit/${pack.id}`} title="Edit Content Pack">
                  <Edit className="h-4 w-4" />
               </Link>
             </Button>
             <AlertDialog>
                 <AlertDialogTrigger asChild>
                      <Button
                         variant="destructive"
                         size="icon"
                         className="h-8 w-8"
                         disabled={isDeleting === pack.id}
                         title="Delete Content Pack"
                       >
                        {isDeleting === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                       </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent>
                     <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                           This action cannot be undone. This will permanently delete the content pack
                           <strong className="px-1">{pack.name}</strong>.
                           It might still be active in some campaigns until removed there.
                        </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                         <AlertDialogCancel disabled={isDeleting === pack.id}>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                             onClick={() => deleteMutation.mutate(pack.id)}
                             disabled={isDeleting === pack.id}
                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                         >
                             {isDeleting === pack.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                             Delete Pack
                         </AlertDialogAction>
                     </AlertDialogFooter>
                 </AlertDialogContent>
              </AlertDialog>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
