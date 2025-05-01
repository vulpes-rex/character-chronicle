
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { saveSourcePack } from '@/services/campaign-service'; // Service to save pack
import type { SourcePack, CharacterRace, CharacterClass, EquipmentItem, BackgroundInfo, Monster, NPC } from '@/lib/types'; // Added NPC type
import { useAuth } from '@/components/auth-provider';
import { AlertCircle, Loader2, Trash2, PlusCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton'; // Import Skeleton

// Zod Schemas for sub-content types (simplified for form validation)
const raceSchema = z.object({
    name: z.string().min(1, "Race name required"),
    traits: z.array(z.string()).optional().default([]),
});
const classSchema = z.object({
    name: z.string().min(1, "Class name required"),
    hitDie: z.enum(['d6', 'd8', 'd10', 'd12'], { message: "Invalid Hit Die"}),
    // Add more class fields as needed for the form (proficiencies, etc.)
});
const itemSchema = z.object({
    name: z.string().min(1, "Item name required"),
    type: z.string().optional(),
    // Add more item fields as needed
});
const backgroundSchema = z.object({
    name: z.string().min(1, "Background name required"),
    skillProficiencies: z.array(z.string()).optional().default([]),
    // Add more background fields
});

// Simplified monster schema for the form
const monsterActionSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    attackBonus: z.number().optional(),
    damageDice: z.string().optional(),
    damageBonus: z.number().optional(),
});
const monsterSpecialAbilitySchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
});

const monsterSchema = z.object({
    id: z.string().optional(), // Optional ID for existing monsters
    name: z.string().min(1, "Monster name required"),
    size: z.string().optional(),
    type: z.string().optional(),
    alignment: z.string().optional(),
    armorClass: z.number().optional(),
    hitPointsDice: z.string().optional().describe('e.g., 2d8+2'), // Combined HP dice + bonus for form simplicity
    speed: z.string().optional(),
    challengeRating: z.string().optional(),
    stats: z.object({ // Basic stats
        strength: z.number().optional(),
        dexterity: z.number().optional(),
        constitution: z.number().optional(),
        intelligence: z.number().optional(),
        wisdom: z.number().optional(),
        charisma: z.number().optional(),
    }).optional(),
    skills: z.string().optional().describe('e.g., Perception +5, Stealth +3'), // Simplified skill string
    senses: z.string().optional(),
    languages: z.string().optional(),
    specialAbilities: z.array(monsterSpecialAbilitySchema).optional().default([]),
    actions: z.array(monsterActionSchema).optional().default([]),
});

// Simplified NPC schema for the form
const npcActionSchema = z.object({ // Reuse monster action schema for simplicity
    name: z.string().min(1),
    description: z.string().optional(),
    attackBonus: z.number().optional(),
    damageDice: z.string().optional(),
    damageBonus: z.number().optional(),
});

const npcSchema = z.object({
    id: z.string().optional(), // Optional ID for existing NPCs
    name: z.string().min(1, "NPC name required"),
    description: z.string().optional().describe('Physical description, role, etc.'),
    personality: z.string().optional().describe('Traits, ideals, bonds, flaws'),
    notes: z.string().optional().describe('DM notes, plot hooks'),
    // Optional combat stats
    size: z.string().optional(),
    type: z.string().optional().describe('e.g., Humanoid (Elf)'),
    alignment: z.string().optional(),
    armorClass: z.number().optional(),
    hitPointsDice: z.string().optional().describe('e.g., 2d8+2'),
    speed: z.string().optional(),
    stats: z.object({
        strength: z.number().optional(),
        dexterity: z.number().optional(),
        constitution: z.number().optional(),
        intelligence: z.number().optional(),
        wisdom: z.number().optional(),
        charisma: z.number().optional(),
    }).optional(),
    skills: z.string().optional().describe('e.g., Persuasion +3, Insight +2'),
    languages: z.string().optional(),
    actions: z.array(npcActionSchema).optional().default([]),
});


// Zod schema for the entire Source Pack form
const sourcePackFormSchema = z.object({
  name: z.string().min(1, 'Pack Name is required'),
  description: z.string().optional(),
  content: z.object({
     races: z.array(raceSchema).optional().default([]),
     classes: z.array(classSchema).optional().default([]),
     items: z.array(itemSchema).optional().default([]),
     backgrounds: z.array(backgroundSchema).optional().default([]),
     monsters: z.array(monsterSchema).optional().default([]),
     npcs: z.array(npcSchema).optional().default([]), // Added NPCs
     // spells: z.array(...).optional(), // Add spells schema if needed
  }),
});

type SourcePackFormData = z.infer<typeof sourcePackFormSchema>;

interface ContentPackFormProps {
  initialData?: SourcePack; // Optional initial data for editing
}

export function ContentPackForm({ initialData }: ContentPackFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const isEditing = !!initialData;

  // Helper to convert Record<string, T> to Array<T> for useFieldArray
   const recordToArray = <T extends { name: string }>(record?: Record<string, Omit<T, 'name' | 'id'>>, type?: 'monster' | 'npc'): (T & {id?: string})[] => {
     if (!record) return [];
     return Object.entries(record).map(([name, data]) => {
        let itemData = { name, ...data } as T & {id?: string};
        // Reconstruct hitPointsDice string for form display
        if (type === 'monster' && (data as Monster).hitPoints) {
            (itemData as any).hitPointsDice = monsterHpToString((data as Monster).hitPoints);
        }
        if (type === 'npc' && (data as NPC).hitPoints) {
            (itemData as any).hitPointsDice = monsterHpToString((data as NPC).hitPoints);
        }
        return itemData;
     });
   };

   // Helper to convert Array<T> back to Record<string, T> for saving
   const arrayToRecord = <T extends { name: string; id?: string }>(array?: T[], type?: 'monster' | 'npc'): Record<string, Omit<T, 'name' | 'id'>> => {
      if (!array) return {};
      return array.reduce((acc, item) => {
          const { name, id, ...rest } = item; // Exclude id from saved data
          if (name) { // Ensure name is present
             let dataToSave = { ...rest };
              // Special handling for monster/NPC HP dice string back to object
              if ((type === 'monster' || type === 'npc') && (rest as any).hitPointsDice) {
                  const hpMatch = (rest as any).hitPointsDice?.match(/(\d+d\d+)\s*([+-]\s*\d+)?/);
                  (dataToSave as Monster).hitPoints = {
                      average: 0, // Average HP is not directly in the form, needs calculation or separate field
                      dice: hpMatch ? hpMatch[1] : '',
                  };
                  // Consider parsing modifier if needed, e.g., hpMatch[2]
                  delete (dataToSave as any).hitPointsDice;
              }
             acc[name] = dataToSave;
          }
          return acc;
      }, {} as Record<string, Omit<T, 'name' | 'id'>>);
   };

    // Helper to convert Monster/NPC HP object back to string for form display
    const monsterHpToString = (hp?: Monster['hitPoints'] | NPC['hitPoints']): string | undefined => {
        if (!hp || !hp.dice) return undefined;
        // For simplicity, just return the dice string. Add average/modifier logic if needed.
        return hp.dice;
    };

    const defaultMonsterValues = {
       name: '',
       size: 'Medium',
       type: 'humanoid',
       alignment: 'unaligned',
       stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
       specialAbilities: [],
       actions: [],
    };

    const defaultNpcValues = {
        name: '',
        size: 'Medium',
        type: 'Humanoid',
        alignment: 'Neutral',
        stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        actions: [],
    };


  const form = useForm<SourcePackFormData>({
    resolver: zodResolver(sourcePackFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      content: {
         races: recordToArray(initialData?.content.races) || [],
         classes: recordToArray(initialData?.content.classes) || [],
         items: recordToArray(initialData?.content.items) || [],
         backgrounds: recordToArray(initialData?.content.backgrounds) || [],
         monsters: recordToArray(initialData?.content.monsters, 'monster') || [],
         npcs: recordToArray(initialData?.content.npcs, 'npc') || [], // Added NPCs
      },
    },
  });

  // useFieldArray hooks for dynamic content lists
  const { fields: raceFields, append: appendRace, remove: removeRace } = useFieldArray({ control: form.control, name: "content.races"});
  const { fields: classFields, append: appendClass, remove: removeClass } = useFieldArray({ control: form.control, name: "content.classes"});
  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({ control: form.control, name: "content.items"});
  const { fields: backgroundFields, append: appendBackground, remove: removeBackground } = useFieldArray({ control: form.control, name: "content.backgrounds"});
  const { fields: monsterFields, append: appendMonster, remove: removeMonster } = useFieldArray({ control: form.control, name: "content.monsters"});
  const { fields: npcFields, append: appendNpc, remove: removeNpc } = useFieldArray({ control: form.control, name: "content.npcs"}); // Added NPC field array


  useEffect(() => {
    // Redirect if user is not an admin or not loaded
    if (!authLoading && !isAdmin) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to access this page.' });
      router.push('/');
    }
    // Check ownership if editing
     if (!authLoading && isEditing && initialData && initialData.creatorId !== user?.uid && initialData.creatorId !== 'system') {
         toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not own this content pack.' });
         router.push('/dm/content');
     }

  }, [authLoading, isAdmin, isEditing, initialData, user, router, toast]);


  const onSubmit = async (data: SourcePackFormData) => {
    if (!user || !isAdmin) {
       setApiError("Authentication error or insufficient permissions.");
       return;
    }
    setIsLoading(true);
    setApiError(null);

    const packDataToSave: Omit<SourcePack, 'createdAt' | 'updatedAt'> & { id?: string } = {
      id: initialData?.id, // Include ID if editing
      name: data.name,
      description: data.description || '',
      creatorId: initialData?.creatorId || user.uid, // Use initial creator or current user
      content: {
         races: arrayToRecord(data.content.races),
         classes: arrayToRecord(data.content.classes),
         items: arrayToRecord(data.content.items),
         backgrounds: arrayToRecord(data.content.backgrounds),
         monsters: arrayToRecord(data.content.monsters, 'monster'), // Convert monsters array back to record
         npcs: arrayToRecord(data.content.npcs, 'npc'), // Convert NPCs array back to record
      },
    };

    try {
      const savedId = await saveSourcePack(packDataToSave, user.uid);
      toast({ title: isEditing ? 'Content Pack Updated' : 'Content Pack Created', description: `"${data.name}" has been saved.` });
      router.push('/dm/content'); // Redirect back to the content list
    } catch (error) {
      console.error('Failed to save source pack:', error);
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      setApiError(message);
      toast({ variant: 'destructive', title: 'Save Failed', description: message });
    } finally {
      setIsLoading(false);
    }
  };

   if (authLoading) {
       return <div className="p-6"><Skeleton className="h-8 w-48 mb-6" /><Skeleton className="h-64 w-full" /></div>; // Loading skeleton
   }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      {/* Pack Info */}
      <Card>
        <CardHeader>
          <CardTitle>Pack Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Pack Name</Label>
            <Input id="name" {...form.register('name')} placeholder="e.g., My Homebrew Content" />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} placeholder="A brief description of the content pack..." />
            {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Content Tabs */}
       <Card>
           <CardHeader>
               <CardTitle>Pack Content</CardTitle>
                <p className="text-sm text-muted-foreground">Add or edit races, classes, items, backgrounds, monsters, and NPCs for this pack.</p>
           </CardHeader>
           <CardContent>
               <Tabs defaultValue="races">
                   <TabsList className="grid w-full grid-cols-6 mb-4"> {/* Updated grid-cols */}
                       <TabsTrigger value="races">Races</TabsTrigger>
                       <TabsTrigger value="classes">Classes</TabsTrigger>
                       <TabsTrigger value="items">Items</TabsTrigger>
                       <TabsTrigger value="backgrounds">Backgrounds</TabsTrigger>
                       <TabsTrigger value="monsters">Monsters</TabsTrigger>
                       <TabsTrigger value="npcs">NPCs</TabsTrigger> {/* Added NPCs trigger */}
                       {/* <TabsTrigger value="spells">Spells</TabsTrigger> */}
                   </TabsList>

                   {/* Races Tab */}
                   <TabsContent value="races">
                       <ContentSection title="Races" fields={raceFields} removeFn={removeRace} appendFn={() => appendRace({ name: '', traits: [] })}>
                           {(index) => (
                               <>
                                   <Input {...form.register(`content.races.${index}.name`)} placeholder="Race Name" className="col-span-2" />
                                   {/* Add more fields for race details (traits, etc.) */}
                                   <Textarea {...form.register(`content.races.${index}.traits`)} placeholder="Traits (comma-separated)" className="col-span-2 h-10 text-xs" />
                               </>
                           )}
                       </ContentSection>
                   </TabsContent>

                   {/* Classes Tab */}
                   <TabsContent value="classes">
                       <ContentSection title="Classes" fields={classFields} removeFn={removeClass} appendFn={() => appendClass({ name: '', hitDie: 'd8' })}>
                           {(index) => (
                               <>
                                   <Input {...form.register(`content.classes.${index}.name`)} placeholder="Class Name" />
                                   <Controller
                                       control={form.control}
                                       name={`content.classes.${index}.hitDie`}
                                       render={({ field }) => (
                                          <select {...field} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                                               <option value="d6">d6</option>
                                               <option value="d8">d8</option>
                                               <option value="d10">d10</option>
                                               <option value="d12">d12</option>
                                           </select>
                                       )}
                                   />
                                   {/* Add more fields for class details */}
                                   <Textarea placeholder="Description/Features..." className="col-span-2 h-10 text-xs" />
                                </>
                           )}
                       </ContentSection>
                   </TabsContent>

                   {/* Items Tab */}
                    <TabsContent value="items">
                       <ContentSection title="Items" fields={itemFields} removeFn={removeItem} appendFn={() => appendItem({ name: '', type: '' })}>
                           {(index) => (
                               <>
                                   <Input {...form.register(`content.items.${index}.name`)} placeholder="Item Name" className="col-span-2" />
                                   <Input {...form.register(`content.items.${index}.type`)} placeholder="Item Type (e.g., Weapon, Armor)" />
                                   {/* Add more fields for item details */}
                                   <Input placeholder="Details (e.g., 1d8 slashing)" className="h-10 text-xs" />
                                </>
                           )}
                       </ContentSection>
                   </TabsContent>

                   {/* Backgrounds Tab */}
                    <TabsContent value="backgrounds">
                       <ContentSection title="Backgrounds" fields={backgroundFields} removeFn={removeBackground} appendFn={() => appendBackground({ name: '', skillProficiencies: [] })}>
                           {(index) => (
                               <>
                                   <Input {...form.register(`content.backgrounds.${index}.name`)} placeholder="Background Name" className="col-span-2" />
                                   {/* Add more fields for background details */}
                                   <Textarea {...form.register(`content.backgrounds.${index}.skillProficiencies`)} placeholder="Skills (comma-separated)" className="col-span-2 h-10 text-xs" />
                                </>
                           )}
                       </ContentSection>
                   </TabsContent>

                    {/* Monsters Tab */}
                    <TabsContent value="monsters">
                       <ContentSection title="Monsters" fields={monsterFields} removeFn={removeMonster} appendFn={() => appendMonster(defaultMonsterValues)}>
                           {(index) => (
                                <MonsterFormFields index={index} control={form.control} register={form.register} />
                           )}
                       </ContentSection>
                   </TabsContent>

                   {/* NPCs Tab */}
                   <TabsContent value="npcs">
                       <ContentSection title="NPCs" fields={npcFields} removeFn={removeNpc} appendFn={() => appendNpc(defaultNpcValues)}>
                           {(index) => (
                               <NpcFormFields index={index} control={form.control} register={form.register} />
                           )}
                       </ContentSection>
                   </TabsContent>

                   {/* Spells Tab (Optional) */}
                   {/* <TabsContent value="spells"> ... </TabsContent> */}
               </Tabs>
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
         <Button type="submit" disabled={isLoading || !form.formState.isValid || authLoading}>
           {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
           {isEditing ? 'Update Content Pack' : 'Create Content Pack'}
         </Button>
      </div>
    </form>
  );
}


// Helper component for rendering sections within tabs
interface ContentSectionProps<T> {
    title: string;
    fields: Array<any>; // from useFieldArray
    removeFn: (index: number) => void;
    appendFn: () => void;
    children: (index: number) => React.ReactNode; // Render prop for fields
}

function ContentSection<T>({ title, fields, removeFn, appendFn, children }: ContentSectionProps<T>) {
    return (
        <div className="space-y-4">
           <h3 className="text-lg font-medium mb-2">{title}</h3>
           <ScrollArea className="h-[300px] border rounded-md p-4">
             <div className="space-y-3">
               {fields.map((field, index) => (
                   <Accordion key={field.id} type="single" collapsible className="border rounded p-2 bg-secondary/30">
                       <AccordionItem value={`item-${index}`} className="border-none">
                           <div className="flex justify-between items-center">
                               <AccordionTrigger className="flex-grow py-1 px-2 text-sm hover:no-underline">
                                   {/* Display name from the form state */}
                                   {(field as any).name || `${title} ${index + 1}`}
                               </AccordionTrigger>
                               <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive h-8 w-8"
                                    onClick={() => removeFn(index)}
                                    aria-label={`Remove ${title} item`}
                                >
                                    <Trash2 className="h-4 w-4" />
                               </Button>
                           </div>
                           <AccordionContent className="px-2 pt-2">
                                {/* Updated grid to better accommodate complex forms */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                                    {children(index)} {/* Render the specific fields */}
                                </div>
                           </AccordionContent>
                       </AccordionItem>
                   </Accordion>
               ))}
                {fields.length === 0 && <p className='text-sm text-muted-foreground text-center py-4'>No {title.toLowerCase()} added yet.</p>}
            </div>
           </ScrollArea>
           <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={appendFn}
                className='mt-4'
            >
                <PlusCircle className="mr-2 h-4 w-4" /> Add {title.slice(0, -1)} {/* Simple singularization */}
            </Button>
       </div>
    );
}


// Component specifically for Monster form fields within the ContentSection accordion
function MonsterFormFields({ index, control, register }: { index: number, control: any, register: any }) {
   const { fields: abilityFields, append: appendAbility, remove: removeAbility } = useFieldArray({ control, name: `content.monsters.${index}.specialAbilities`});
   const { fields: actionFields, append: appendAction, remove: removeAction } = useFieldArray({ control, name: `content.monsters.${index}.actions`});

   return (
       <>
           {/* Basic Info */}
           <Input {...register(`content.monsters.${index}.name`)} placeholder="Monster Name" className="col-span-full sm:col-span-2" />
           <Input {...register(`content.monsters.${index}.size`)} placeholder="Size (e.g., Medium)" />
           <Input {...register(`content.monsters.${index}.type`)} placeholder="Type (e.g., humanoid)" />
           <Input {...register(`content.monsters.${index}.alignment`)} placeholder="Alignment" />
           <Input type="number" {...register(`content.monsters.${index}.armorClass`, { valueAsNumber: true })} placeholder="AC" />
           <Input {...register(`content.monsters.${index}.hitPointsDice`)} placeholder="HP (e.g., 2d8+2)" />
           <Input {...register(`content.monsters.${index}.speed`)} placeholder="Speed (e.g., 30 ft)" />
           <Input {...register(`content.monsters.${index}.challengeRating`)} placeholder="CR (e.g., 1/4)" />
           <Input {...register(`content.monsters.${index}.languages`)} placeholder="Languages" className="sm:col-span-2" />
           <Textarea {...register(`content.monsters.${index}.senses`)} placeholder="Senses (e.g., darkvision 60 ft.)" className="sm:col-span-2 h-10 text-xs" />
           <Textarea {...register(`content.monsters.${index}.skills`)} placeholder="Skills (e.g., Perception +5)" className="sm:col-span-full h-10 text-xs" />


           {/* Stats */}
           <div className="col-span-full mt-2 pt-2 border-t">
               <h4 className="text-xs font-medium mb-1">Stats</h4>
               <div className="grid grid-cols-3 lg:grid-cols-6 gap-1">
                    <Input type="number" {...register(`content.monsters.${index}.stats.strength`, { valueAsNumber: true })} placeholder="STR" className="text-xs h-7" />
                    <Input type="number" {...register(`content.monsters.${index}.stats.dexterity`, { valueAsNumber: true })} placeholder="DEX" className="text-xs h-7" />
                    <Input type="number" {...register(`content.monsters.${index}.stats.constitution`, { valueAsNumber: true })} placeholder="CON" className="text-xs h-7" />
                    <Input type="number" {...register(`content.monsters.${index}.stats.intelligence`, { valueAsNumber: true })} placeholder="INT" className="text-xs h-7" />
                    <Input type="number" {...register(`content.monsters.${index}.stats.wisdom`, { valueAsNumber: true })} placeholder="WIS" className="text-xs h-7" />
                    <Input type="number" {...register(`content.monsters.${index}.stats.charisma`, { valueAsNumber: true })} placeholder="CHA" className="text-xs h-7" />
               </div>
           </div>

           {/* Special Abilities */}
           <div className="col-span-full mt-2 pt-2 border-t">
               <h4 className="text-xs font-medium mb-1 flex justify-between items-center">
                  <span>Special Abilities</span>
                  <Button type="button" variant="outline" size="xs" onClick={() => appendAbility({ name: '', description: '' })}>Add Ability</Button>
              </h4>
               <div className="space-y-1">
                  {abilityFields.map((field, abilityIndex) => (
                       <div key={field.id} className="flex items-start gap-1">
                            <Input {...register(`content.monsters.${index}.specialAbilities.${abilityIndex}.name`)} placeholder="Ability Name" className="text-xs h-7 flex-grow-[1] min-w-0" />
                            <Textarea {...register(`content.monsters.${index}.specialAbilities.${abilityIndex}.description`)} placeholder="Description" className="text-xs h-7 flex-grow-[2] min-w-0" rows={1} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeAbility(abilityIndex)} className="h-7 w-7 text-destructive hover:text-destructive shrink-0"><Trash2 className="h-3 w-3" /></Button>
                       </div>
                  ))}
               </div>
           </div>

            {/* Actions */}
           <div className="col-span-full mt-2 pt-2 border-t">
               <h4 className="text-xs font-medium mb-1 flex justify-between items-center">
                  <span>Actions</span>
                  <Button type="button" variant="outline" size="xs" onClick={() => appendAction({ name: '', description: '' })}>Add Action</Button>
              </h4>
              <div className="space-y-1">
                  {actionFields.map((field, actionIndex) => (
                       <div key={field.id} className="relative grid grid-cols-1 sm:grid-cols-5 gap-1 items-start border-b pb-1 last:border-none">
                            <Input {...register(`content.monsters.${index}.actions.${actionIndex}.name`)} placeholder="Action Name" className="text-xs h-7 sm:col-span-2" />
                            <Input type="number" {...register(`content.monsters.${index}.actions.${actionIndex}.attackBonus`, { valueAsNumber: true })} placeholder="Atk Bonus" className="text-xs h-7" />
                            <Input {...register(`content.monsters.${index}.actions.${actionIndex}.damageDice`)} placeholder="Dmg Dice" className="text-xs h-7" />
                            {/*<Input type="number" {...register(`content.monsters.${index}.actions.${actionIndex}.damageBonus`, { valueAsNumber: true })} placeholder="Dmg Bonus" className="text-xs h-7" />*/}
                            <Textarea {...register(`content.monsters.${index}.actions.${actionIndex}.description`)} placeholder="Description (if not attack)" className="text-xs h-7 col-span-full" rows={1}/>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeAction(actionIndex)} className="h-7 w-7 text-destructive hover:text-destructive shrink-0 sm:absolute sm:right-0 sm:top-0"><Trash2 className="h-3 w-3" /></Button>
                       </div>
                   ))}
              </div>
           </div>
       </>
   );
}


// Component specifically for NPC form fields within the ContentSection accordion
function NpcFormFields({ index, control, register }: { index: number, control: any, register: any }) {
   const { fields: actionFields, append: appendAction, remove: removeAction } = useFieldArray({ control, name: `content.npcs.${index}.actions`});

   return (
       <>
           {/* Basic Info */}
           <Input {...register(`content.npcs.${index}.name`)} placeholder="NPC Name" className="col-span-full sm:col-span-2 lg:col-span-4" />

            {/* Description & Personality */}
           <Textarea {...register(`content.npcs.${index}.description`)} placeholder="Physical description, role..." className="col-span-full lg:col-span-2 h-20 text-xs" />
           <Textarea {...register(`content.npcs.${index}.personality`)} placeholder="Personality traits, ideals, bonds, flaws..." className="col-span-full lg:col-span-2 h-20 text-xs" />
           <Textarea {...register(`content.npcs.${index}.notes`)} placeholder="DM notes, plot hooks, secrets..." className="col-span-full h-20 text-xs" />


           {/* Combat Stats Section (Optional) */}
           <h4 className="col-span-full mt-2 pt-2 border-t text-sm font-medium">Optional Combat Stats</h4>
           <Input {...register(`content.npcs.${index}.size`)} placeholder="Size (e.g., Medium)" />
           <Input {...register(`content.npcs.${index}.type`)} placeholder="Type (e.g., Humanoid)" />
           <Input {...register(`content.npcs.${index}.alignment`)} placeholder="Alignment" />
           <Input type="number" {...register(`content.npcs.${index}.armorClass`, { valueAsNumber: true })} placeholder="AC" />
           <Input {...register(`content.npcs.${index}.hitPointsDice`)} placeholder="HP (e.g., 2d8+2)" />
           <Input {...register(`content.npcs.${index}.speed`)} placeholder="Speed (e.g., 30 ft)" />
           <Input {...register(`content.npcs.${index}.languages`)} placeholder="Languages" className="sm:col-span-2" />
           <Textarea {...register(`content.npcs.${index}.skills`)} placeholder="Skill Bonuses (e.g., Persuasion +3)" className="sm:col-span-2 h-10 text-xs" />


           {/* Stats */}
           <div className="col-span-full mt-2 pt-2 border-t">
               <h4 className="text-xs font-medium mb-1">Stats</h4>
               <div className="grid grid-cols-3 lg:grid-cols-6 gap-1">
                    <Input type="number" {...register(`content.npcs.${index}.stats.strength`, { valueAsNumber: true })} placeholder="STR" className="text-xs h-7" />
                    <Input type="number" {...register(`content.npcs.${index}.stats.dexterity`, { valueAsNumber: true })} placeholder="DEX" className="text-xs h-7" />
                    <Input type="number" {...register(`content.npcs.${index}.stats.constitution`, { valueAsNumber: true })} placeholder="CON" className="text-xs h-7" />
                    <Input type="number" {...register(`content.npcs.${index}.stats.intelligence`, { valueAsNumber: true })} placeholder="INT" className="text-xs h-7" />
                    <Input type="number" {...register(`content.npcs.${index}.stats.wisdom`, { valueAsNumber: true })} placeholder="WIS" className="text-xs h-7" />
                    <Input type="number" {...register(`content.npcs.${index}.stats.charisma`, { valueAsNumber: true })} placeholder="CHA" className="text-xs h-7" />
               </div>
           </div>

           {/* Actions */}
           <div className="col-span-full mt-2 pt-2 border-t">
               <h4 className="text-xs font-medium mb-1 flex justify-between items-center">
                  <span>Actions</span>
                  <Button type="button" variant="outline" size="xs" onClick={() => appendAction({ name: '', description: '' })}>Add Action</Button>
              </h4>
              <div className="space-y-1">
                  {actionFields.map((field, actionIndex) => (
                      <div key={field.id} className="relative grid grid-cols-1 sm:grid-cols-5 gap-1 items-start border-b pb-1 last:border-none">
                            <Input {...register(`content.npcs.${index}.actions.${actionIndex}.name`)} placeholder="Action Name" className="text-xs h-7 sm:col-span-2" />
                            <Input type="number" {...register(`content.npcs.${index}.actions.${actionIndex}.attackBonus`, { valueAsNumber: true })} placeholder="Atk Bonus" className="text-xs h-7" />
                            <Input {...register(`content.npcs.${index}.actions.${actionIndex}.damageDice`)} placeholder="Dmg Dice" className="text-xs h-7" />
                            <Textarea {...register(`content.npcs.${index}.actions.${actionIndex}.description`)} placeholder="Description (if not attack)" className="text-xs h-7 col-span-full" rows={1}/>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeAction(actionIndex)} className="h-7 w-7 text-destructive hover:text-destructive shrink-0 sm:absolute sm:right-0 sm:top-0"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                   ))}
              </div>
           </div>
       </>
   );
}