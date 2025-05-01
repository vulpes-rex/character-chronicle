
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { saveEncounter } from '@/services/encounter-service'; // New service function
import { loadAllCampaigns, getCombinedContentFromPacks } from '@/services/campaign-service';
import { loadAllCharacters } from '@/services/character-service';
import type { Encounter, Campaign, Character, Monster, EncounterParticipant } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { AlertCircle, Loader2, Trash2, PlusCircle, Users, MinusCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from './ui/skeleton';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs for participants

// Zod schema for a single participant in the form
const participantSchema = z.object({
    id: z.string().uuid(), // Unique ID for this instance in the encounter
    sourceId: z.string().min(1, "Source ID required"), // Character or Monster ID
    type: z.enum(['character', 'monster']),
    name: z.string(), // Pre-filled based on source selection
    // Removed HP, AC etc. - these will be derived when running combat
});

// Zod schema for the Encounter form
const encounterFormSchema = z.object({
  name: z.string().min(1, 'Encounter Name is required'),
  description: z.string().optional(),
  campaignId: z.string().min(1, 'Campaign must be selected'),
  participants: z.array(participantSchema).min(1, 'At least one participant is required'),
});

type EncounterFormData = z.infer<typeof encounterFormSchema>;

interface EncounterFormProps {
  initialData?: Encounter; // Optional initial data for editing
}

export function EncounterForm({ initialData }: EncounterFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const isEditing = !!initialData;

  const form = useForm<EncounterFormData>({
    resolver: zodResolver(encounterFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      campaignId: initialData?.campaignId || '',
      participants: initialData?.participants.map(p => ({ // Map existing data
          id: p.id,
          sourceId: p.sourceId,
          type: p.type,
          name: p.name,
      })) || [],
    },
  });

  const { fields: participantFields, append: appendParticipant, remove: removeParticipant } = useFieldArray({
      control: form.control,
      name: "participants",
  });

  const selectedCampaignId = form.watch('campaignId');

  // Fetch DM's campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[], Error>({
      queryKey: ['campaigns', user?.uid, 'dm'],
      queryFn: () => loadAllCampaigns(user?.uid, 'dm'),
      enabled: !authLoading && !!user && isAdmin,
  });

   // Fetch characters based on selected campaign
   const { data: characters = [], isLoading: charactersLoading } = useQuery<Character[], Error>({
       queryKey: ['characters', 'campaign', selectedCampaignId],
       queryFn: async () => {
          if (!selectedCampaignId) return [];
          const campaign = campaigns.find(c => c.id === selectedCampaignId);
          if (!campaign?.characterIds || campaign.characterIds.length === 0) return [];
          // Inefficient: Load all characters and filter. Needs optimization.
          const allChars = await loadAllCharacters(); // Consider a service fn loadCharactersByIds
          return allChars.filter(char => campaign.characterIds.includes(char.id));
       },
       enabled: !!selectedCampaignId && !campaignsLoading,
   });

   // Fetch monsters based on selected campaign's source packs
    const { data: monsters = [], isLoading: monstersLoading } = useQuery<Array<Monster & { id: string }>, Error>({
       queryKey: ['monsters', 'campaign', selectedCampaignId],
       queryFn: async () => {
           if (!selectedCampaignId) return [];
           const campaign = campaigns.find(c => c.id === selectedCampaignId);
           if (!campaign) return [];
           const content = await getCombinedContentFromPacks(campaign.activeSourcePackIds || ['srd']);
           return Object.entries(content.monsters || {}).map(([id, data]) => ({ id, ...data }));
       },
       enabled: !!selectedCampaignId && !campaignsLoading,
    });


  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'Only DMs can create or edit encounters.' });
      router.push('/');
    }
    // Add permission check for editing specific encounter based on campaign DM later
  }, [authLoading, isAdmin, router, toast]);


  const onSubmit = async (data: EncounterFormData) => {
    if (!user || !isAdmin) {
       setApiError("Authentication error or insufficient permissions.");
       return;
    }
    setIsLoading(true);
    setApiError(null);

    // --- Derive full participant data before saving ---
    const fullParticipants: EncounterParticipant[] = data.participants.map(p => {
        let sourceData: Character | Monster | undefined;
        let maxHp = 0;
        let armorClass = 10; // Default AC

        if (p.type === 'character') {
            sourceData = characters.find(c => c.id === p.sourceId);
            maxHp = sourceData?.hitPoints.max || 0;
            // AC calculation for characters is complex, might need simplification here or do it on combat start
             armorClass = sourceData ? 10 + Math.floor((sourceData.stats.dexterity - 10) / 2) : 10; // Simplified example
        } else {
            sourceData = monsters.find(m => m.id === p.sourceId);
            maxHp = sourceData?.hitPoints?.average || 0; // Use average HP for monsters by default
            armorClass = sourceData?.armorClass || 10;
        }

        return {
            ...p,
            name: sourceData?.name || sourceData?.characterName || 'Unknown', // Use characterName for characters
            currentHp: maxHp, // Start at full HP
            maxHp: maxHp,
            armorClass: armorClass,
            initiative: null, // Initiative rolled at combat start
            conditions: [],
        };
    });


    const encounterToSave: Omit<Encounter, 'createdAt' | 'updatedAt'> & { id?: string } = {
      id: initialData?.id, // Include ID if editing
      campaignId: data.campaignId,
      name: data.name,
      description: data.description || '',
      participants: fullParticipants,
      status: initialData?.status || 'setup', // Default to setup
      currentTurnIndex: initialData?.currentTurnIndex ?? null,
      round: initialData?.round ?? 0,
    };

    try {
      const savedId = await saveEncounter(encounterToSave, user.uid); // Pass DM ID for permission check
      toast({ title: isEditing ? 'Encounter Updated' : 'Encounter Created', description: `"${data.name}" has been saved.` });
      router.push('/dm/encounters'); // Redirect back to the encounter list
    } catch (error) {
      console.error('Failed to save encounter:', error);
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      setApiError(message);
      toast({ variant: 'destructive', title: 'Save Failed', description: message });
    } finally {
      setIsLoading(false);
    }
  };

   const handleAddParticipant = (type: 'character' | 'monster') => {
       let availableOptions = type === 'character' ? characters : monsters;
       if (availableOptions.length > 0) {
           const firstOption = availableOptions[0];
           appendParticipant({
               id: uuidv4(), // Generate unique ID for this instance
               sourceId: firstOption.id,
               type: type,
               name: firstOption.name || (firstOption as Character).characterName || 'Unnamed', // Handle character name
           });
       } else {
           toast({ variant: 'destructive', title: 'No Available Options', description: `No ${type}s found for the selected campaign.` });
       }
   };

   // Update participant name when sourceId changes
    const handleParticipantSourceChange = (index: number, newSourceId: string, type: 'character' | 'monster') => {
       let sourceData: Character | Monster | undefined;
       if (type === 'character') {
           sourceData = characters.find(c => c.id === newSourceId);
       } else {
           sourceData = monsters.find(m => m.id === newSourceId);
       }
       form.setValue(`participants.${index}.name`, sourceData?.name || (sourceData as Character)?.characterName || 'Unknown', { shouldValidate: true });
       form.setValue(`participants.${index}.sourceId`, newSourceId, { shouldValidate: true });
       form.setValue(`participants.${index}.type`, type, { shouldValidate: true }); // Ensure type is set
    };


  const dataLoading = authLoading || campaignsLoading || charactersLoading || monstersLoading;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      {/* Encounter Info */}
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit Encounter' : 'New Encounter'}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Encounter Name</Label>
            <Input id="name" {...form.register('name')} placeholder="e.g., Goblin Ambush" />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>

           <div className="space-y-2">
               <Label htmlFor="campaignId">Campaign</Label>
               <Controller
                   name="campaignId"
                   control={form.control}
                   render={({ field }) => (
                       <Select
                           onValueChange={(value) => {
                               field.onChange(value);
                               form.reset({ ...form.getValues(), participants: [] }); // Reset participants if campaign changes
                           }}
                           value={field.value}
                           disabled={campaignsLoading || isEditing} // Disable if loading or editing existing
                        >
                           <SelectTrigger id="campaignId" className={campaignsLoading ? 'animate-pulse' : ''}>
                               <SelectValue placeholder={campaignsLoading ? "Loading campaigns..." : "Select Campaign..."} />
                           </SelectTrigger>
                           <SelectContent>
                               {campaigns.map((campaign) => (
                                   <SelectItem key={campaign.id} value={campaign.id}>
                                       {campaign.name}
                                   </SelectItem>
                               ))}
                               {campaigns.length === 0 && !campaignsLoading && <SelectItem value="" disabled>No campaigns found</SelectItem>}
                           </SelectContent>
                       </Select>
                   )}
               />
               {form.formState.errors.campaignId && <p className="text-xs text-destructive">{form.formState.errors.campaignId.message}</p>}
           </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} placeholder="A brief description of the encounter setup or goals..." />
            {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
          </div>
        </CardContent>
      </Card>

       {/* Participants */}
      <Card>
         <CardHeader>
            <CardTitle>Participants</CardTitle>
             <p className="text-sm text-muted-foreground">Add characters and monsters to the encounter.</p>
         </CardHeader>
          <CardContent className="space-y-4">
             {participantFields.length === 0 && (
                 <p className="text-sm text-muted-foreground text-center">No participants added yet.</p>
             )}
             {participantFields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2 border p-2 rounded">
                     {/* Participant Type (implicitly set by dropdown choice) */}
                     <Controller
                         name={`participants.${index}.sourceId`}
                         control={form.control}
                         render={({ field: controllerField }) => (
                             <Select
                                 onValueChange={(value) => {
                                     const option = [...characters, ...monsters].find(o => o.id === value);
                                     handleParticipantSourceChange(index, value, option?.type === 'monster' ? 'monster' : 'character');
                                 }}
                                 value={controllerField.value}
                                 disabled={dataLoading}
                             >
                                 <SelectTrigger className="flex-grow">
                                     <SelectValue placeholder={dataLoading ? "Loading..." : "Select Character/Monster..."} />
                                 </SelectTrigger>
                                 <SelectContent>
                                      {characters.length > 0 && <Label className='px-2 py-1.5 text-xs font-semibold'>Characters</Label>}
                                      {characters.map(char => (
                                          <SelectItem key={char.id} value={char.id}>
                                              {char.characterName} (Lvl {char.level} {char.race} {char.class})
                                          </SelectItem>
                                      ))}
                                       {monsters.length > 0 && <Label className='px-2 py-1.5 text-xs font-semibold mt-1 border-t'>Monsters</Label>}
                                      {monsters.map(monster => (
                                          <SelectItem key={monster.id} value={monster.id}>
                                              {monster.name} (CR {monster.challengeRating || '?'})
                                          </SelectItem>
                                      ))}
                                 </SelectContent>
                             </Select>
                         )}
                     />
                     <Button
                         type="button"
                         variant="ghost"
                         size="icon"
                         className="text-destructive hover:text-destructive shrink-0"
                         onClick={() => removeParticipant(index)}
                         aria-label="Remove Participant"
                         disabled={isLoading}
                     >
                         <Trash2 className="h-4 w-4" />
                     </Button>
                  </div>
             ))}
              {form.formState.errors.participants && <p className="text-xs text-destructive mt-2">{form.formState.errors.participants.message || 'Error in participant list.'}</p>}

             <div className="flex gap-2 pt-4 border-t">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddParticipant('character')}
                    disabled={!selectedCampaignId || charactersLoading || isLoading}
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Character
                </Button>
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddParticipant('monster')}
                    disabled={!selectedCampaignId || monstersLoading || isLoading}
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Monster
                </Button>
            </div>
         </CardContent>
     </Card>

      {/* Submission */}
      {apiError && (
          <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Save Error</AlertTitle>
              <AlertDescription>{apiError}</AlertDescription>
          </Alert>
      )}
      <div className="flex justify-end gap-4">
         <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
          </Button>
         <Button type="submit" disabled={isLoading || dataLoading || !form.formState.isValid || authLoading}>
           {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
           {isEditing ? 'Update Encounter' : 'Create Encounter'}
         </Button>
      </div>
    </form>
  );
}
