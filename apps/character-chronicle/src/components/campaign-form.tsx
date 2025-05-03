'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button'; // Use alias
import { Input } from '@/components/ui/input'; // Use alias
import { Textarea } from '@/components/ui/textarea'; // Use alias
import { Label } from '@/components/ui/label'; // Use alias
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Use alias
import { Checkbox } from '@/components/ui/checkbox'; // Use alias
import { useToast } from '@/hooks/use-toast'; // Use alias
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider'; // Use alias
import { Loader2 } from 'lucide-react';
import type { Campaign, SourcePack } from '@/lib/types'; // Use alias
import { createCampaignAction, updateCampaignAction, loadSourcePacksByCreatorAction } from '@/app/actions/campaign-actions'; // Use Server Actions

const campaignFormSchema = z.object({
  name: z.string().min(1, { message: 'Campaign name is required.' }).max(100),
  description: z.string().max(500).optional(),
  activeSourcePackIds: z.array(z.string()).optional(), // Array of source pack IDs
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface CampaignFormProps {
  initialData?: Campaign; // For editing existing campaigns
}

export function CampaignForm({ initialData }: CampaignFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [availablePacks, setAvailablePacks] = useState<SourcePack[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(false);

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      activeSourcePackIds: initialData?.activeSourcePackIds || ['srd'], // Default to SRD
    },
  });

  useEffect(() => {
    // Fetch available source packs created by the current user (DM) + system packs
    const fetchPacks = async () => {
      if (!user || !isAdmin) return;
      setLoadingPacks(true);
      try {
        const result = await loadSourcePacksByCreatorAction(user.uid);
        if (result.success) {
             // Add SRD pack manually if not already present (though it's system-owned)
             const allPacks = [...result.packs];
             if (!allPacks.find(p => p.id === 'srd')) {
                 allPacks.unshift({ id: 'srd', name: 'System Reference Document (SRD)', creatorId: 'system', description:'', content: {}, createdAt: new Date(0), updatedAt: new Date(0) });
             }
            setAvailablePacks(allPacks);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to load source packs.' });
        }
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load source packs.' });
      } finally {
        setLoadingPacks(false);
      }
    };

    fetchPacks();
  }, [user, isAdmin, toast]);


  async function onSubmit(data: CampaignFormData) {
    if (!user || !isAdmin) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in as a DM to save a campaign.' });
      return;
    }
    setIsLoading(true);

    try {
      let result;
      if (initialData) {
        // Update existing campaign
        result = await updateCampaignAction(initialData.id, data, user.uid);
      } else {
        // Create new campaign
        result = await createCampaignAction(data, user.uid);
      }

      if (result.success) {
        toast({
          title: initialData ? 'Campaign Updated' : 'Campaign Created',
          description: `Campaign "${data.name}" has been saved successfully.`,
        });
        // Redirect to the campaign management page or the campaigns list
        const campaignId = initialData ? initialData.id : result.campaignId;
        router.push(campaignId ? `/campaigns/${campaignId}/manage` : '/campaigns');
        router.refresh(); // Refresh server components
      } else {
        throw new Error(result.error || 'An unknown error occurred.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Could not save the campaign.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading) {
      return <Loader2 className="h-8 w-8 animate-spin" />; // Or a skeleton loader
  }
  if (!user || !isAdmin) {
      return <p>You do not have permission to manage campaigns.</p>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{initialData ? 'Edit Campaign' : 'Create New Campaign'}</CardTitle>
            <CardDescription>
              {initialData ? 'Update the details for your campaign.' : 'Fill in the details for your new campaign.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter campaign name" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe your campaign..." {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Source Pack Selection */}
             <FormField
               control={form.control}
               name="activeSourcePackIds"
               render={() => (
                 <FormItem>
                   <div className="mb-4">
                     <FormLabel className="text-base">Active Content Packs</FormLabel>
                     <FormDescription>
                       Select the content packs to use in this campaign. SRD is always included.
                     </FormDescription>
                   </div>
                   {loadingPacks ? (
                        <p>Loading content packs...</p>
                   ) : availablePacks.length > 1 ? ( // Check if there are packs other than SRD
                     availablePacks.map((pack) => (
                       pack.id !== 'srd' && ( // Don't show checkbox for SRD
                         <FormField
                           key={pack.id}
                           control={form.control}
                           name="activeSourcePackIds"
                           render={({ field }) => {
                             return (
                               <FormItem
                                 key={pack.id}
                                 className="flex flex-row items-start space-x-3 space-y-0"
                               >
                                 <FormControl>
                                   <Checkbox
                                     checked={field.value?.includes(pack.id)}
                                     onCheckedChange={(checked) => {
                                       const currentValue = field.value || ['srd']; // Ensure SRD is always present implicitly
                                       const updatedValue = checked
                                         ? [...currentValue, pack.id]
                                         : currentValue.filter((value) => value !== pack.id);
                                        // Ensure 'srd' isn't accidentally removed if logic changes
                                        const finalValue = [...new Set([...updatedValue, 'srd'])];
                                       field.onChange(finalValue);
                                     }}
                                     disabled={pack.id === 'srd'} // SRD is always active
                                   />
                                 </FormControl>
                                 <FormLabel className="font-normal">
                                   {pack.name} {pack.creatorId !== 'system' && `(by ${pack.creatorId === user?.uid ? 'You' : 'Other'})`}
                                 </FormLabel>
                               </FormItem>
                             )
                           }}
                         />
                       )
                     ))
                   ) : (
                     <p className="text-sm text-muted-foreground">No custom content packs found.</p>
                   )}
                   <FormMessage />
                 </FormItem>
               )}
             />

          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading || authLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? 'Update Campaign' : 'Create Campaign'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

    