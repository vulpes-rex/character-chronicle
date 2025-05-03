'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button'; // Use alias
import { Input } from '@/components/ui/input'; // Use alias
import { Textarea } from '@/components/ui/textarea'; // Use alias
import { Label } from '@/components/ui/label'; // Use alias
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Use alias
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Use alias
import { useToast } from '@/hooks/use-toast'; // Use alias
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider'; // Use alias
import { Loader2, Trash2, PlusCircle, Users, Swords } from 'lucide-react';
import type { Encounter, EncounterParticipant, Monster, NPC, Campaign } from '@/lib/types'; // Use alias
import { saveEncounterAction, loadAllCampaignsAction, getCombinedContentFromPacksAction } from '@/app/actions/encounter-actions'; // Use Server Actions

// Zod schema for a single participant
const participantSchema = z.object({
  id: z.string().optional(), // Keep existing ID if editing
  sourceId: z.string().min(1, 'Source ID is required'),
  type: z.enum(['character', 'monster', 'npc']),
  name: z.string().min(1, 'Participant name is required'), // Name for this instance (e.g., "Goblin 1")
  // Initiative/HP/AC will be managed during run-time, but might be pre-set optionally
  initiative: z.number().nullable().optional(),
  currentHp: z.number().optional(),
  maxHp: z.number().optional(),
  armorClass: z.number().optional(),
});

// Zod schema for the encounter form
const encounterFormSchema = z.object({
  name: z.string().min(1, { message: 'Encounter name is required.' }).max(100),
  description: z.string().max(500).optional(),
  campaignId: z.string().min(1, { message: 'Campaign association is required.' }),
  participants: z.array(participantSchema).min(1, 'At least one participant is required.'),
});

type EncounterFormData = z.infer<typeof encounterFormSchema>;

interface EncounterFormProps {
  initialData?: Encounter; // For editing existing encounters
}

export function EncounterForm({ initialData }: EncounterFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [dmCampaigns, setDmCampaigns] = useState<Campaign[]>([]);
  const [availableMonsters, setAvailableMonsters] = useState<Monster[]>([]);
  const [availableNpcs, setAvailableNpcs] = useState<NPC[]>([]); // Added NPCs
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);

  const form = useForm<EncounterFormData>({
    resolver: zodResolver(encounterFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      campaignId: initialData?.campaignId || '',
      participants: initialData?.participants || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'participants',
  });

  // Fetch campaigns the current user is DMing
  useEffect(() => {
    const fetchDmCampaigns = async () => {
      if (!user || !isAdmin) return;
      setLoadingCampaigns(true);
      const result = await loadAllCampaignsAction(user.uid, 'dm'); // Assuming action exists
      if (result.success) {
        setDmCampaigns(result.campaigns);
         // Pre-select campaign if editing
         if (initialData?.campaignId && !form.getValues('campaignId')) {
             form.setValue('campaignId', initialData.campaignId);
         } else if (result.campaigns.length === 1 && !form.getValues('campaignId')) {
             // Pre-select if DM only has one campaign
              form.setValue('campaignId', result.campaigns[0].id);
         }
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load your campaigns.' });
      }
      setLoadingCampaigns(false);
    };
    fetchDmCampaigns();
  }, [user, isAdmin, initialData, form, toast]);

  // Fetch monsters and NPCs based on the selected campaign's source packs
   const selectedCampaignId = form.watch('campaignId');
   useEffect(() => {
       const fetchCampaignContent = async () => {
           if (!selectedCampaignId) {
               setAvailableMonsters([]);
               setAvailableNpcs([]);
               return;
           };
           const selectedCampaign = dmCampaigns.find(c => c.id === selectedCampaignId);
           if (!selectedCampaign) return;

           setLoadingContent(true);
           const result = await getCombinedContentFromPacksAction(selectedCampaign.activeSourcePackIds || ['srd']);
           if (result.success && result.content) {
               const monstersArray = Object.entries(result.content.monsters || {}).map(([key, value]) => ({ ...value, id: key, name: key }));
               const npcsArray = Object.entries(result.content.npcs || {}).map(([key, value]) => ({ ...value, id: key, name: key }));
               setAvailableMonsters(monstersArray);
               setAvailableNpcs(npcsArray); // Set available NPCs
           } else {
               toast({ variant: 'destructive', title: 'Error', description: 'Failed to load content for the selected campaign.' });
               setAvailableMonsters([]);
               setAvailableNpcs([]);
           }
           setLoadingContent(false);
       };

       fetchCampaignContent();
   }, [selectedCampaignId, dmCampaigns, toast]);


  // Function to add a new participant row
  const addParticipant = (type: 'monster' | 'npc') => {
    const defaultParticipant = type === 'monster' ? availableMonsters[0] : availableNpcs[0];
    append({
      sourceId: defaultParticipant?.id || '',
      type: type,
      name: defaultParticipant ? `${defaultParticipant.name} ${fields.filter(f => f.type === type).length + 1}` : `New ${type}`,
      // Optionally pre-fill HP/AC if available on definition
       maxHp: (defaultParticipant as any)?.hitPoints?.average,
       currentHp: (defaultParticipant as any)?.hitPoints?.average,
       armorClass: (defaultParticipant as any)?.armorClass,
    });
  };


  async function onSubmit(data: EncounterFormData) {
    if (!user || !isAdmin) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in as a DM to save an encounter.' });
      return;
    }
    setIsLoading(true);

     // Ensure participants have necessary defaults before saving
     const processedParticipants = data.participants.map((p, index) => {
        let definition: Monster | NPC | undefined;
         if (p.type === 'monster') {
             definition = availableMonsters.find(m => m.id === p.sourceId);
         } else if (p.type === 'npc') {
             definition = availableNpcs.find(n => n.id === p.sourceId);
         }
         return {
            ...p,
            id: p.id || `${p.type}-${p.sourceId}-${Date.now()}-${index}`, // Generate unique ID if new
            name: p.name || `${definition?.name || `Unknown ${p.type}`} ${index + 1}`,
             // Set defaults based on definition if not provided in form (might be better handled server-side)
             maxHp: p.maxHp ?? (definition as any)?.hitPoints?.average ?? 10,
             currentHp: p.currentHp ?? (definition as any)?.hitPoints?.average ?? 10,
             armorClass: p.armorClass ?? (definition as any)?.armorClass ?? 10,
         };
     });


    const encounterDataToSave: Omit<Encounter, 'createdAt' | 'updatedAt' | 'id' | 'status' | 'currentTurnIndex' | 'round'> & { id?: string } = {
      name: data.name,
      description: data.description,
      campaignId: data.campaignId,
      participants: processedParticipants, // Save processed participants
      ...(initialData && { id: initialData.id }), // Add id if updating
    };

    try {
      // Use Server Action to save/update
      const result = await saveEncounterAction(encounterDataToSave, user.uid);

      if (result.success) {
        toast({
          title: initialData ? 'Encounter Updated' : 'Encounter Created',
          description: `Encounter "${data.name}" saved successfully.`,
        });
        router.push('/dm/encounters'); // Redirect to encounters list
        router.refresh(); // Refresh if needed
      } else {
        throw new Error(result.error || 'An unknown error occurred.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Could not save the encounter.',
      });
    } finally {
      setIsLoading(false);
    }
  }

   if (authLoading) {
       return <Loader2 className="h-8 w-8 animate-spin" />; // Or a skeleton loader
   }
   if (!user || !isAdmin) {
       return <p>You do not have permission to manage encounters.</p>;
   }
    if (loadingCampaigns) {
       return <p>Loading campaigns...</p>;
   }
    if (dmCampaigns.length === 0) {
        return <p>You must create a campaign before creating an encounter. <Link href="/dm/campaigns/create" className="underline">Create Campaign</Link></p>;
    }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{initialData ? 'Edit Encounter' : 'Create New Encounter'}</CardTitle>
            <CardDescription>
              Define the name, description, campaign, and participants for this encounter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Encounter Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Goblin Ambush" {...field} disabled={isLoading} />
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
                    <Textarea placeholder="Describe the setting, goals, or notes..." {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="campaignId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading || loadingCampaigns}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a campaign..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {dmCampaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Participants Section */}
            <div className="space-y-4 border-t pt-6">
               <FormLabel className="text-lg font-medium">Participants</FormLabel>
               {loadingContent && <p>Loading monsters and NPCs...</p>}
               {!loadingContent && (availableMonsters.length === 0 && availableNpcs.length === 0) && selectedCampaignId && (
                  <p className="text-sm text-muted-foreground">No monsters or NPCs found in the selected campaign's content packs.</p>
               )}

               {fields.map((item, index) => (
                 <Card key={item.id} className="p-4 border">
                   <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                     {/* Participant Type (could be inferred or selected if characters are also added) */}
                     {/* <FormField ... name={`participants.${index}.type`} ... /> */}

                     {/* Source Selection (Monster or NPC) */}
                     <FormField
                       control={form.control}
                       name={`participants.${index}.type`}
                       render={({ field }) => (
                         <FormItem className="md:col-span-1">
                             <FormLabel>Type</FormLabel>
                             <Select onValueChange={(value) => {
                                 field.onChange(value);
                                 form.setValue(`participants.${index}.sourceId`, ''); // Reset source on type change
                                 form.setValue(`participants.${index}.name`, `New ${value}`);
                             }} defaultValue={field.value} disabled={isLoading}>
                                 <FormControl><SelectTrigger><SelectValue placeholder="Type..." /></SelectTrigger></FormControl>
                                 <SelectContent>
                                     <SelectItem value="monster">Monster</SelectItem>
                                     <SelectItem value="npc">NPC</SelectItem>
                                     {/* <SelectItem value="character">Character</SelectItem> */}
                                 </SelectContent>
                             </Select>
                             <FormMessage />
                         </FormItem>
                       )}
                     />
                     <FormField
                       control={form.control}
                       name={`participants.${index}.sourceId`}
                       render={({ field }) => (
                         <FormItem className="md:col-span-2">
                           <FormLabel>Source {form.getValues(`participants.${index}.type`) === 'monster' ? 'Monster' : 'NPC'}</FormLabel>
                            <Select
                                onValueChange={(value) => {
                                     field.onChange(value);
                                      // Auto-fill name and stats when source changes
                                      const selectedSource = form.getValues(`participants.${index}.type`) === 'monster'
                                        ? availableMonsters.find(m => m.id === value)
                                        : availableNpcs.find(n => n.id === value);
                                      if (selectedSource) {
                                          form.setValue(`participants.${index}.name`, `${selectedSource.name} ${fields.filter(f => f.sourceId === value).length}`); // Auto-name
                                          form.setValue(`participants.${index}.maxHp`, (selectedSource as any).hitPoints?.average);
                                          form.setValue(`participants.${index}.currentHp`, (selectedSource as any).hitPoints?.average);
                                          form.setValue(`participants.${index}.armorClass`, (selectedSource as any).armorClass);
                                      }
                                 }}
                                defaultValue={field.value}
                                disabled={isLoading || loadingContent || !form.getValues(`participants.${index}.type`)}
                           >
                             <FormControl><SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger></FormControl>
                             <SelectContent>
                               {form.getValues(`participants.${index}.type`) === 'monster' && availableMonsters.map((monster) => (
                                 <SelectItem key={monster.id} value={monster.id!}>{monster.name}</SelectItem>
                               ))}
                                {form.getValues(`participants.${index}.type`) === 'npc' && availableNpcs.map((npc) => (
                                    <SelectItem key={npc.id} value={npc.id!}>{npc.name}</SelectItem>
                                ))}
                               {/* Add Character selection if needed */}
                             </SelectContent>
                           </Select>
                           <FormMessage />
                         </FormItem>
                       )}
                     />
                     {/* Instance Name */}
                     <FormField
                       control={form.control}
                       name={`participants.${index}.name`}
                       render={({ field }) => (
                         <FormItem className="md:col-span-1">
                           <FormLabel>Instance Name</FormLabel>
                           <FormControl>
                             <Input placeholder="e.g., Goblin Boss" {...field} disabled={isLoading} />
                           </FormControl>
                           <FormMessage />
                         </FormItem>
                       )}
                     />

                     {/* Remove Button */}
                     <Button
                       type="button"
                       variant="destructive"
                       size="icon"
                       onClick={() => remove(index)}
                       disabled={isLoading}
                       className="md:col-span-1 self-end"
                     >
                       <Trash2 className="h-4 w-4" />
                     </Button>
                   </div>
                 </Card>
               ))}
               <div className="flex gap-2">
                 <Button
                   type="button"
                   variant="outline"
                   onClick={() => addParticipant('monster')}
                   disabled={isLoading || loadingContent || availableMonsters.length === 0}
                 >
                   <PlusCircle className="mr-2 h-4 w-4" /> Add Monster
                 </Button>
                  <Button
                      type="button"
                      variant="outline"
                      onClick={() => addParticipant('npc')}
                      disabled={isLoading || loadingContent || availableNpcs.length === 0}
                  >
                      <Users className="mr-2 h-4 w-4" /> Add NPC
                  </Button>
                 {/* Add button for Characters if needed */}
               </div>
                <FormMessage>{form.formState.errors.participants?.message || form.formState.errors.participants?.root?.message}</FormMessage>
            </div>

          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading || authLoading || loadingCampaigns || loadingContent}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? 'Update Encounter' : 'Create Encounter'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

    