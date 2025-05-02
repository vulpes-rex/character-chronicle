
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardDescription, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createCampaign, updateCampaign, loadSourcePacksByCreator } from '@/services/campaign-service'; // Import services
import type { Campaign, SourcePack } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from './ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from './ui/skeleton';

// Zod schema for the Campaign form
const campaignFormSchema = z.object({
  name: z.string().min(1, 'Campaign Name is required'),
  description: z.string().optional(),
  activeSourcePackIds: z.array(z.string()).optional().default(['srd']), // Default to SRD
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface CampaignFormProps {
  initialData?: Campaign; // Optional initial data for editing
}

export function CampaignForm({ initialData }: CampaignFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const isEditing = !!initialData;

  // Fetch DM's source packs + system packs (like SRD)
   const { data: availableSourcePacks = [], isLoading: packsLoading } = useQuery<SourcePack[], Error>({
       queryKey: ['sourcePacks', user?.uid, 'system'], // Include 'system' to fetch system packs too
       queryFn: async () => {
           if (!user?.uid) return [];
           const [dmPacks, systemPacks] = await Promise.all([
               loadSourcePacksByCreator(user.uid),
               loadSourcePacksByCreator('system'), // Assuming 'system' ID for SRD etc.
           ]);
           // Ensure SRD is always present if it exists in system packs
           const srdPack = systemPacks.find(p => p.id === 'srd');
           const otherSystemPacks = systemPacks.filter(p => p.id !== 'srd');
           const combined = [...dmPacks, ...otherSystemPacks];
           return srdPack ? [srdPack, ...combined] : combined; // Prioritize SRD
       },
       enabled: !authLoading && !!user && isAdmin,
   });


  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      activeSourcePackIds: initialData?.activeSourcePackIds || ['srd'], // Ensure SRD is default
    },
  });

   // Update defaultValues when initialData or packs finish loading
   useEffect(() => {
       if (initialData) {
           form.reset({
                name: initialData.name,
                description: initialData.description || '',
                activeSourcePackIds: initialData.activeSourcePackIds || ['srd'],
           });
       } else if (!packsLoading && availableSourcePacks.some(p => p.id === 'srd')) {
           // Set SRD as default for new campaigns if available
           form.reset({ ...form.getValues(), activeSourcePackIds: ['srd'] });
       }
   }, [initialData, form.reset, form, packsLoading, availableSourcePacks]);


  useEffect(() => {
    // Redirect if user is not an admin or not loaded
    if (!authLoading && !isAdmin) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to access this page.' });
      router.push('/');
    }
    // Check ownership if editing
     if (!authLoading && isEditing && initialData && initialData.dmId !== user?.uid) {
         toast({ variant: 'destructive', title: 'Unauthorized', description: 'You are not the DM of this campaign.' });
         router.push('/campaigns');
     }
  }, [authLoading, isAdmin, isEditing, initialData, user, router, toast]);


  const onSubmit = async (data: CampaignFormData) => {
    if (!user || !isAdmin) {
       setApiError("Authentication error or insufficient permissions.");
       return;
    }
    setIsLoading(true);
    setApiError(null);

    try {
      if (isEditing && initialData?.id) {
        // Update existing campaign
        await updateCampaign(initialData.id, data, user.uid);
        toast({ title: 'Campaign Updated', description: `"${data.name}" settings saved.` });
        router.push(`/campaigns/${initialData.id}/manage`); // Redirect to manage page
      } else {
        // Create new campaign
        const newCampaignId = await createCampaign(data, user.uid);
        toast({ title: 'Campaign Created', description: `"${data.name}" is ready!` });
        router.push(`/campaigns/${newCampaignId}/manage`); // Redirect to manage page
      }
    } catch (error) {
      console.error('Failed to save campaign:', error);
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      setApiError(message);
      toast({ variant: 'destructive', title: 'Save Failed', description: message });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || (isAdmin && packsLoading)) {
     return <div className="p-6"><Skeleton className="h-8 w-48 mb-6" /><Skeleton className="h-64 w-full" /></div>; // Loading skeleton
  }


  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      {/* Campaign Info */}
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit Campaign' : 'New Campaign'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input id="name" {...form.register('name')} placeholder="e.g., The Dragon's Hoard" />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} placeholder="A brief description or premise for the campaign..." />
            {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
          </div>
        </CardContent>
      </Card>

       {/* Source Pack Selection */}
       <Card>
         <CardHeader>
            <CardTitle>Content Source Packs</CardTitle>
            <CardDescription>Select the content packs available to players in this campaign. SRD is recommended.</CardDescription>
         </CardHeader>
          <CardContent>
              {packsLoading ? (
                 <Skeleton className="h-24 w-full" />
              ) : availableSourcePacks.length === 0 ? (
                 <p className="text-sm text-muted-foreground">No custom content packs found. Only SRD content will be available.</p>
              ) : (
                <div className="space-y-2">
                    {availableSourcePacks.map((pack) => (
                       <div key={pack.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={`pack-${pack.id}`}
                                checked={form.watch('activeSourcePackIds')?.includes(pack.id)}
                                onCheckedChange={(checked) => {
                                    const currentPacks = form.getValues('activeSourcePackIds') || [];
                                    const newPacks = checked
                                        ? [...currentPacks, pack.id]
                                        : currentPacks.filter((id) => id !== pack.id);
                                    form.setValue('activeSourcePackIds', newPacks, { shouldValidate: true, shouldDirty: true });
                                }}
                                // Disable unchecking the SRD pack
                                disabled={pack.id === 'srd'}
                            />
                            <Label htmlFor={`pack-${pack.id}`} className="font-normal cursor-pointer">
                                {pack.name} ({pack.creatorId === 'system' ? 'System' : 'Mine'})
                                {pack.id === 'srd' && <span className="text-xs text-muted-foreground ml-1">(Required)</span>}
                            </Label>
                        </div>
                    ))}
                     {form.formState.errors.activeSourcePackIds && <p className="text-xs text-destructive mt-2">{form.formState.errors.activeSourcePackIds.message}</p>}
                 </div>
              )}
          </CardContent>
      </Card>


      {/* Submission */}
      {apiError && (
          <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{apiError}</AlertDescription>
          </Alert>
      )}
      <CardFooter className="flex justify-end gap-4 px-0">
         <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
          </Button>
         <Button type="submit" disabled={isLoading || !form.formState.isValid || authLoading || packsLoading}>
           {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
           {isEditing ? 'Save Changes' : 'Create Campaign'}
         </Button>
      </CardFooter>
    </form>
  );
}
