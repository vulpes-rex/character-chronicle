
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { getCharacterClasses, getCharacterRaces, getCumulativeClassFeatures, getRaceTraitsDetails, getAvailableEquipmentItems } from '@/services/dnd-api'; // Keep using these for dropdowns/features
import { saveCharacter, updateCharacter } from '@/services/character-service';
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState } from '@/lib/types'; // Use central types
import { rollDice } from '@/lib/types'; // Import rollDice utility
import { Skeleton } from './ui/skeleton';
import { AlertCircle, Dices, Loader2, Trash2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from './ui/alert'; // Added AlertTitle and AlertDescription


// Define Zod schema for form validation
const statsSchema = z.object({
  strength: z.number().min(1).max(30),
  dexterity: z.number().min(1).max(30),
  constitution: z.number().min(1).max(30),
  intelligence: z.number().min(1).max(30),
  wisdom: z.number().min(1).max(30),
  charisma: z.number().min(1).max(30),
});

// Basic equipment item schema for validation within the form
const equipmentItemSchema = z.object({
    name: z.string().min(1),
    quantity: z.number().min(1).optional().default(1),
    description: z.string().optional(),
    isEquipped: z.boolean().optional().default(false), // Added isEquipped
    // Add other relevant fields if needed for validation during add/edit within the form itself
    // weight: z.number().optional(),
    // type: z.string().optional(),
});


const characterFormSchema = z.object({
  playerName: z.string().min(1, 'Player Name is required'),
  characterName: z.string().min(1, 'Character Name is required'),
  race: z.string().min(1, 'Race selection is required'),
  class: z.string().min(1, 'Class selection is required'),
  level: z.number().min(1, 'Level must be at least 1').max(20, 'Level cannot exceed 20'),
  background: z.string().min(1, 'Background is required'),
  alignment: z.string().min(1, 'Alignment is required'),
  stats: statsSchema,
  skills: z.record(z.boolean()), // Record<string, boolean>
  // hitPoints: z.object({ // HP/HD derived later or set based on defaults
  //   max: z.number().min(1),
  //   current: z.number(),
  //   temporary: z.number().min(0),
  // }),
  // hitDice: z.object({
  //   total: z.number().min(1),
  //   remaining: z.number(),
  //   dieType: z.string().nullable(),
  // }),
   equipment: z.array(equipmentItemSchema).optional().default([]), // Validate items added to the list
  backstory: z.string().optional(),
  appearance: z.string().optional(),
});

type CharacterFormData = z.infer<typeof characterFormSchema>;

// All D&D 5e skills
const ALL_SKILLS = [
    "acrobatics", "animal handling", "arcana", "athletics", "deception",
    "history", "insight", "intimidation", "investigation", "medicine",
    "nature", "perception", "performance", "persuasion", "religion",
    "sleight of hand", "stealth", "survival"
];

interface CharacterFormProps {
  initialData?: Character; // Optional initial data for editing
}

export function CharacterForm({ initialData }: CharacterFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<Awaited<ReturnType<typeof getCharacterClasses>>>([]);
  const [availableRaces, setAvailableRaces] = useState<Awaited<ReturnType<typeof getCharacterRaces>>>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const isEditing = !!initialData;

  const form = useForm<CharacterFormData>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: useMemo(() => {
        if (initialData) {
            // Map Character type to CharacterFormData type
             // Ensure skills object includes all possible skills
             const initialSkills = ALL_SKILLS.reduce((acc, skill) => {
                acc[skill] = !!initialData.skills[skill]; // Default to false if not present
                return acc;
             }, {} as Record<string, boolean>);

             // Map equipment: ensure quantity is number, default to 1 if missing
             const initialEquipment = initialData.equipment.map(item => ({
                 ...item,
                 quantity: typeof item.quantity === 'number' ? item.quantity : 1,
                 isEquipped: item.isEquipped ?? false, // Ensure default value
             }));

            return {
                playerName: initialData.playerName || '',
                characterName: initialData.characterName || '',
                race: initialData.race || '',
                class: initialData.class || '',
                level: initialData.level || 1,
                background: initialData.background || '',
                alignment: initialData.alignment || '',
                stats: initialData.stats || { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
                skills: initialSkills,
                equipment: initialEquipment,
                backstory: initialData.backstory || '',
                appearance: initialData.appearance || '',
            };
        }
         // Default for new character
         const defaultSkills = ALL_SKILLS.reduce((acc, skill) => {
            acc[skill] = false;
            return acc;
         }, {} as Record<string, boolean>);

        return {
            playerName: '',
            characterName: '',
            race: undefined, // Use undefined to trigger placeholder
            class: undefined, // Use undefined to trigger placeholder
            level: 1,
            background: '',
            alignment: '',
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            skills: defaultSkills,
            equipment: [],
            backstory: '',
            appearance: '',
        };
    }, [initialData]), // Recalculate only if initialData changes
  });

  const { fields: equipmentFields, append: appendEquipment, remove: removeEquipment } = useFieldArray({
      control: form.control,
      name: "equipment"
  });

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingDropdowns(true);
      setApiError(null);
      try {
        const [classes, races] = await Promise.all([
          getCharacterClasses(),
          getCharacterRaces(),
        ]);
        setAvailableClasses(classes);
        setAvailableRaces(races);
      } catch (error) {
        console.error("Failed to load classes or races:", error);
        setApiError("Failed to load necessary data. Please try refreshing.");
        toast({ variant: "destructive", title: "Error", description: "Could not load class/race data." });
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchData();
  }, [toast]); // Only run once on mount


  // --- Stat Rolling ---
  const rollStat = useCallback(() => {
    // Roll 4d6, drop the lowest
    const rolls = Array.from({ length: 4 }, () => rollDice('1d6'));
    rolls.sort((a, b) => a - b);
    rolls.shift(); // Remove the lowest
    return rolls.reduce((sum, roll) => sum + roll, 0);
  }, []);

  const rollAllStats = useCallback(() => {
    form.setValue('stats', {
      strength: rollStat(),
      dexterity: rollStat(),
      constitution: rollStat(),
      intelligence: rollStat(),
      wisdom: rollStat(),
      charisma: rollStat(),
    }, { shouldValidate: true, shouldDirty: true }); // Mark form as dirty and validate
    toast({ title: "Stats Rolled!", description: "New ability scores generated." });
  }, [form, rollStat, toast]);


  // --- Form Submission ---
  const onSubmit = async (data: CharacterFormData) => {
    setIsLoading(true);
    setApiError(null);

    // --- Derive missing character properties ---
    const selectedClassData = availableClasses.find(c => c.name === data.class);
    const selectedRaceData = availableRaces.find(r => r.name === data.race);

    if (!selectedClassData || !selectedRaceData) {
        toast({ variant: "destructive", title: "Error", description: "Invalid class or race selected." });
        setIsLoading(false);
        return;
    }

    // 1. Hit Points & Hit Dice
    const conModifier = Math.floor((data.stats.constitution - 10) / 2);
    const hitDieSides = parseInt(selectedClassData.hitDie.substring(1), 10);
    let maxHp = hitDieSides + conModifier; // First level
    if (data.level > 1) {
      const averageRoll = Math.ceil((hitDieSides + 1) / 2);
      maxHp += (data.level - 1) * (averageRoll + conModifier);
    }
    maxHp = Math.max(1, maxHp); // Ensure HP is at least 1

    const hitPoints: HitPointsState = isEditing && initialData?.hitPoints
      ? { // Preserve current HP if editing, but ensure it doesn't exceed new max
          max: maxHp,
          current: Math.min(initialData.hitPoints.current, maxHp),
          temporary: initialData.hitPoints.temporary || 0,
        }
      : { // Defaults for new character
          max: maxHp,
          current: maxHp,
          temporary: 0,
        };

    const hitDice: HitDiceState = {
      total: data.level,
      remaining: isEditing && initialData?.hitDice ? Math.min(initialData.hitDice.remaining, data.level) : data.level, // Preserve remaining if editing, capped by new level
      dieType: selectedClassData.hitDie,
    };


    // 2. Proficiencies (Combine class and race - simplified for now)
     const proficiencies = {
         armor: selectedClassData.proficiencies.armor ?? [],
         weapons: selectedClassData.proficiencies.weapons ?? [],
         tools: selectedClassData.proficiencies.tools ?? [],
         savingThrows: selectedClassData.proficiencies.savingThrows ?? [],
         // Skills are handled by the form's skills state
     };
     // TODO: Add race proficiencies if the API provides them

    // 3. Features (Fetch based on final class/race/level)
    let features: Feature[] = [];
    try {
        const [classFeats, raceFeats] = await Promise.all([
            getCumulativeClassFeatures(data.class, data.level),
            getRaceTraitsDetails(selectedRaceData.traits),
        ]);
         // Combine and remove duplicates (simple name check for now)
         const combined = [...raceFeats, ...classFeats];
         const uniqueFeatureNames = new Set<string>();
         features = combined.filter(feat => {
             if (!uniqueFeatureNames.has(feat.name)) {
                 uniqueFeatureNames.add(feat.name);
                 return true;
             }
             return false;
         });

         // Initialize currentUses for features that have maxUses
         features = features.map(feat => ({
            ...feat,
            currentUses: feat.maxUses !== null && feat.maxUses !== undefined ? feat.maxUses : undefined,
         }));

    } catch (error) {
        console.error("Failed to fetch features during save:", error);
        toast({ variant: "destructive", title: "Feature Error", description: "Could not fetch all character features. Saving without full feature list." });
        // Proceeding without features, or could choose to block save
    }


     // Ensure equipment has quantity (default to 1 if somehow missing)
    const finalEquipment = data.equipment?.map(item => ({
        ...item,
        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
        // Ensure isEquipped defaults to false if not present
        isEquipped: item.isEquipped ?? false,
    })) ?? [];


    // --- Construct final Character object ---
    const characterToSave: Omit<Character, 'id' | 'createdAt' | 'updatedAt'> = {
      playerName: data.playerName,
      characterName: data.characterName,
      race: data.race,
      class: data.class,
      level: data.level,
      background: data.background,
      alignment: data.alignment,
      stats: data.stats,
      skills: data.skills, // Already Record<string, boolean>
      hitPoints: hitPoints,
      hitDice: hitDice,
      equipment: finalEquipment, // Use the processed equipment
      proficiencies: proficiencies,
      features: features, // Use features with initialized currentUses
      backstory: data.backstory || '',
      appearance: data.appearance || '',
    };

    try {
      if (isEditing && initialData?.id) {
        // When updating, try to preserve existing feature uses if the feature still exists
        const existingFeaturesMap = new Map(initialData.features.map(f => [f.name, f.currentUses]));
        const updatedFeaturesWithPreservedUses = characterToSave.features.map(f => ({
            ...f,
            // If feature existed before and had uses, keep the old count (unless it resets/changed max)
            // Simple preservation for now - more complex logic might be needed for level changes
            currentUses: existingFeaturesMap.get(f.name) ?? f.currentUses,
        }));

        await updateCharacter(initialData.id, {
          ...characterToSave,
          features: updatedFeaturesWithPreservedUses
        });
        toast({ title: 'Character Updated', description: `${data.characterName} has been successfully updated.` });
        router.push(`/character/view/${initialData.id}`); // Redirect to character sheet view
      } else {
        const newId = await saveCharacter(characterToSave);
        toast({ title: 'Character Created', description: `${data.characterName} has been successfully created.` });
        router.push(`/character/view/${newId}`); // Redirect to new character sheet view
      }
      // Optionally reset form: form.reset(defaultValues_based_on_mode);
    } catch (error) {
      console.error('Failed to save character:', error);
      setApiError(error instanceof Error ? error.message : 'An unknown error occurred during saving.');
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save character to the database.' });
    } finally {
      setIsLoading(false);
    }
  };


    // --- Utility: Calculate Modifier ---
    const getModifier = (statValue: number | undefined): number => {
      return Math.floor(((statValue ?? 10) - 10) / 2);
    };


  if (isLoadingDropdowns) {
      return (
           <div className="space-y-6 p-4 md:p-6">
              <Skeleton className="h-10 w-1/3" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-10 w-24" />
           </div>
      )
  }

  if (apiError && !isLoading) { // Only show API error if not loading dropdowns
     return (
          <Alert variant="destructive" className="m-4 md:m-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{apiError}</AlertDescription>
          </Alert>
      );
  }


  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      {/* --- Basic Info --- */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Player Name */}
          <div className="space-y-2">
            <Label htmlFor="playerName">Player Name</Label>
            <Input id="playerName" {...form.register('playerName')} placeholder="Your Name" />
            {form.formState.errors.playerName && <p className="text-xs text-destructive">{form.formState.errors.playerName.message}</p>}
          </div>

          {/* Character Name */}
          <div className="space-y-2">
            <Label htmlFor="characterName">Character Name</Label>
            <Input id="characterName" {...form.register('characterName')} placeholder="Character's Name" />
            {form.formState.errors.characterName && <p className="text-xs text-destructive">{form.formState.errors.characterName.message}</p>}
          </div>

          {/* Level */}
          <div className="space-y-2">
            <Label htmlFor="level">Level</Label>
            <Input id="level" type="number" {...form.register('level', { valueAsNumber: true })} min="1" max="20" />
             {form.formState.errors.level && <p className="text-xs text-destructive">{form.formState.errors.level.message}</p>}
          </div>

          {/* Race */}
           <div className="space-y-2">
              <Label htmlFor="race">Race</Label>
              <Controller
                  name="race"
                  control={form.control}
                  render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value || ""}>
                          <SelectTrigger id="race">
                              <SelectValue placeholder="Select Race..." />
                          </SelectTrigger>
                          <SelectContent>
                              {availableRaces.map((race) => (
                                  <SelectItem key={race.name} value={race.name}>
                                      {race.name}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  )}
              />
              {form.formState.errors.race && <p className="text-xs text-destructive">{form.formState.errors.race.message}</p>}
          </div>


          {/* Class */}
          <div className="space-y-2">
             <Label htmlFor="class">Class</Label>
             <Controller
                  name="class"
                  control={form.control}
                  render={({ field }) => (
                     <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value || ""}>
                       <SelectTrigger id="class">
                          <SelectValue placeholder="Select Class..." />
                       </SelectTrigger>
                       <SelectContent>
                          {availableClasses.map((cls) => (
                             <SelectItem key={cls.name} value={cls.name}>
                                {cls.name}
                             </SelectItem>
                          ))}
                       </SelectContent>
                     </Select>
                  )}
              />
              {form.formState.errors.class && <p className="text-xs text-destructive">{form.formState.errors.class.message}</p>}
          </div>

          {/* Background */}
          <div className="space-y-2">
            <Label htmlFor="background">Background</Label>
            <Input id="background" {...form.register('background')} placeholder="e.g., Acolyte, Urchin" />
             {form.formState.errors.background && <p className="text-xs text-destructive">{form.formState.errors.background.message}</p>}
          </div>

          {/* Alignment */}
          <div className="space-y-2">
            <Label htmlFor="alignment">Alignment</Label>
            <Input id="alignment" {...form.register('alignment')} placeholder="e.g., Lawful Good, Chaotic Neutral" />
             {form.formState.errors.alignment && <p className="text-xs text-destructive">{form.formState.errors.alignment.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* --- Ability Scores --- */}
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Ability Scores</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={rollAllStats}>
            <Dices className="mr-2 h-4 w-4" /> Roll Stats (4d6 Drop Lowest)
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.keys(form.getValues('stats')).map((statName) => (
            <div key={statName} className="space-y-2 text-center p-3 border rounded-md bg-secondary/30 relative pt-6">
              <Label htmlFor={`stats.${statName}`} className="uppercase text-xs font-semibold tracking-wider text-muted-foreground absolute top-1 left-1/2 transform -translate-x-1/2 capitalize">{statName}</Label>
              <div className='relative mt-1'>
                  <Input
                    id={`stats.${statName}`}
                    type="number"
                    {...form.register(`stats.${statName as keyof CharacterFormData['stats']}`, { valueAsNumber: true })}
                    className="text-4xl font-bold text-center h-auto p-0 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 appearance-none m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min="1"
                    max="30"
                    aria-label={`${statName} score`}
                   />
                    <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 border border-primary bg-background rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold text-primary shadow-md">
                       {getModifier(form.watch(`stats.${statName as keyof CharacterFormData['stats']}`)) >= 0 ? '+' : ''}{getModifier(form.watch(`stats.${statName as keyof CharacterFormData['stats']}`))}
                    </div>
              </div>
               {form.formState.errors.stats?.[statName as keyof CharacterFormData['stats']] && <p className="text-xs text-destructive absolute bottom-[-20px] left-0 right-0">{form.formState.errors.stats[statName as keyof CharacterFormData['stats']]?.message}</p>}
            </div>
          ))}
        </CardContent>
      </Card>


        {/* --- Skills --- */}
        <Card>
            <CardHeader>
                <CardTitle>Skills</CardTitle>
                <p className="text-sm text-muted-foreground">Select proficient skills. Proficiency choices depend on class and background (validation not fully implemented).</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                {ALL_SKILLS.map((skill) => (
                    <Controller
                        key={skill}
                        name={`skills.${skill}`}
                        control={form.control}
                        render={({ field }) => (
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id={`skill-${skill}`}
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    aria-labelledby={`skill-label-${skill}`}
                                />
                                <Label htmlFor={`skill-${skill}`} id={`skill-label-${skill}`} className="capitalize text-sm font-normal cursor-pointer">
                                    {skill}
                                </Label>
                                {/* TODO: Add associated ability score in parenthesis */}
                            </div>
                        )}
                    />
                ))}
                 {form.formState.errors.skills && <p className="text-xs text-destructive col-span-full mt-2">{form.formState.errors.skills.message || 'Error in skills selection.'}</p>}
            </CardContent>
        </Card>


      {/* --- Equipment (Simplified for form) --- */}
        {/* NOTE: Full equipment management might be better in the CharacterSheet view after creation */}
       <Card>
            <CardHeader>
                <CardTitle>Starting Equipment</CardTitle>
                 <p className="text-sm text-muted-foreground">Add initial equipment (more can be added later).</p>
            </CardHeader>
            <CardContent className="space-y-4">
                 {equipmentFields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2 border p-2 rounded">
                        <Input
                            {...form.register(`equipment.${index}.name`)}
                            placeholder="Item Name"
                            className='flex-grow'
                        />
                        <Input
                             type="number"
                             {...form.register(`equipment.${index}.quantity`, { valueAsNumber: true })}
                             placeholder="Qty"
                             min="1"
                             className="w-16 shrink-0"
                         />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive shrink-0"
                            onClick={() => removeEquipment(index)}
                            aria-label={`Remove ${field.name || 'item'}`}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                     </div>
                 ))}
                 <Button
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={() => appendEquipment({ name: '', quantity: 1, description: '', isEquipped: false })} // Ensure default values match schema
                 >
                     Add Equipment Item
                 </Button>
                  {form.formState.errors.equipment && <p className="text-xs text-destructive mt-2">{form.formState.errors.equipment.message || 'Error in equipment list.'}</p>}
             </CardContent>
        </Card>


      {/* --- Backstory & Appearance --- */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="backstory">Backstory</Label>
            <Textarea id="backstory" {...form.register('backstory')} placeholder="Character's history, personality traits, ideals, bonds, flaws..." rows={6} />
             {form.formState.errors.backstory && <p className="text-xs text-destructive">{form.formState.errors.backstory.message}</p>}
          </div>
          <div>
            <Label htmlFor="appearance">Appearance</Label>
            <Textarea id="appearance" {...form.register('appearance')} placeholder="Describe the character's physical appearance..." rows={4} />
             {form.formState.errors.appearance && <p className="text-xs text-destructive">{form.formState.errors.appearance.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* --- Submission --- */}
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
         <Button type="submit" disabled={isLoading}>
           {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
           {isEditing ? 'Update Character' : 'Create Character'}
         </Button>
      </div>
    </form>
  );
}


