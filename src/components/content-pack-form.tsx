
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
import type { SourcePack, CharacterRace, CharacterClass, EquipmentItem, BackgroundInfo } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { AlertCircle, Loader2, Trash2, PlusCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from './ui/scroll-area';

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


// Zod schema for the entire Source Pack form
const sourcePackFormSchema = z.object({
  name: z.string().min(1, 'Pack Name is required'),
  description: z.string().optional(),
  content: z.object({
     races: z.array(raceSchema).optional().default([]),
     classes: z.array(classSchema).optional().default([]),
     items: z.array(itemSchema).optional().default([]),
     backgrounds: z.array(backgroundSchema).optional().default([]),
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
   const recordToArray = <T extends { name: string }>(record?: Record<string, Omit<T, 'name'>>): T[] => {
     if (!record) return [];
     return Object.entries(record).map(([name, data]) => ({ name, ...data } as T));
   };

   // Helper to convert Array<T> back to Record<string, T> for saving
   const arrayToRecord = <T extends { name: string }>(array?: T[]): Record<string, Omit<T, 'name'>> => {
      if (!array) return {};
      return array.reduce((acc, item) => {
          const { name, ...rest } = item;
          if (name) { // Ensure name is present
             acc[name] = rest;
          }
          return acc;
      }, {} as Record<string, Omit<T, 'name'>>);
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
      },
    },
  });

  // useFieldArray hooks for dynamic content lists
  const { fields: raceFields, append: appendRace, remove: removeRace } = useFieldArray({ control: form.control, name: "content.races"});
  const { fields: classFields, append: appendClass, remove: removeClass } = useFieldArray({ control: form.control, name: "content.classes"});
  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({ control: form.control, name: "content.items"});
  const { fields: backgroundFields, append: appendBackground, remove: removeBackground } = useFieldArray({ control: form.control, name: "content.backgrounds"});


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
       return <div className="p-6">Loading authentication...</div>; // Or a proper loading skeleton
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
                <p className="text-sm text-muted-foreground">Add or edit races, classes, items, and backgrounds for this pack.</p>
           </CardHeader>
           <CardContent>
               <Tabs defaultValue="races">
                   <TabsList className="grid w-full grid-cols-4 mb-4">
                       <TabsTrigger value="races">Races</TabsTrigger>
                       <TabsTrigger value="classes">Classes</TabsTrigger>
                       <TabsTrigger value="items">Items</TabsTrigger>
                       <TabsTrigger value="backgrounds">Backgrounds</TabsTrigger>
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
                   <div key={field.id} className="grid grid-cols-4 gap-2 items-center border-b pb-2 last:border-0">
                       {children(index)} {/* Render the specific fields for this content type */}
                       <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-8 w-8 justify-self-end"
                            onClick={() => removeFn(index)}
                            aria-label={`Remove ${title} item`}
                        >
                            <Trash2 className="h-4 w-4" />
                       </Button>
                   </div>
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
