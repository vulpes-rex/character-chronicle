
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
import { getCharacterClasses, getCharacterRaces, getCumulativeClassFeatures, getRaceTraitsDetails, getAvailableEquipmentItems, getBackgroundDetails } from '@/services/dnd-api'; // Keep using these for dropdowns/features
import { saveCharacter, updateCharacter } from '@/services/character-service';
import type { Character, EquipmentItem, Feature, HitPointsState, HitDiceState, CharacterClass } from '@/lib/types'; // Use central types
import { rollDice, ALL_SKILLS, SKILL_ABILITY_MAP } from '@/lib/types'; // Import utilities and constants
import { Skeleton } from './ui/skeleton';
import { AlertCircle, Dices, Loader2, Trash2, Info } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from './ui/alert'; // Added AlertTitle and AlertDescription
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'; // For skill choice info
import { useQuery } from '@tanstack/react-query'; // Import useQuery
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';


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
   equipment: z.array(equipmentItemSchema).optional().default([]), // Validate items added to the list
  backstory: z.string().optional(),
  appearance: z.string().optional(),
}).refine(data => {
    // Validation for skill choices based on class
    const selectedClass = availableClasses.find(c => c.name === data.class);
    if (!selectedClass?.proficiencies?.skills) return true; // No choice needed

    const numRequired = selectedClass.proficiencies.skills.choose;
    const chosenSkills = ALL_SKILLS.filter(skill => data.skills[skill] && selectedClass.proficiencies.skills?.options.includes(skill));
    return chosenSkills.length === numRequired;
}, {
    message: 'Please select the correct number of skill proficiencies required by your class.',
    path: ['skills'], // Attach error to the skills section
});


type CharacterFormData = z.infer<typeof characterFormSchema>;

// Declare availableClasses outside refine scope but initialize inside component
let availableClasses: CharacterClass[] = [];

interface CharacterFormProps {
  initialData?: Character; // Optional initial data for editing
}

export function CharacterForm({ initialData }: CharacterFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  // State for classes and races is now managed locally
  const [localAvailableClasses, setLocalAvailableClasses] = useState<CharacterClass[]>([]);
  const [availableRaces, setAvailableRaces] = useState<Awaited<ReturnType<typeof getCharacterRaces>>>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const isEditing = !!initialData;

  const form = useForm<CharacterFormData>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: useMemo(() => {
        if (initialData) {
             const initialSkills = ALL_SKILLS.reduce((acc, skill) => {
                acc[skill] = !!initialData.skills[skill];
                return acc;
             }, {} as Record<string, boolean>);

             const initialEquipment = initialData.equipment.map(item => ({
                 ...item,
                 quantity: typeof item.quantity === 'number' ? item.quantity : 1,
                 isEquipped: item.isEquipped ?? false,
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
         const defaultSkills = ALL_SKILLS.reduce((acc, skill) => {
            acc[skill] = false;
            return acc;
         }, {} as Record<string, boolean>);

        return {
            playerName: '',
            characterName: '',
            race: undefined,
            class: undefined,
            level: 1,
            background: '',
            alignment: '',
            stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
            skills: defaultSkills,
            equipment: [],
            backstory: '',
            appearance: '',
        };
    }, [initialData]),
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
        setLocalAvailableClasses(classes);
        availableClasses = classes; // Update the global variable for Zod schema
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
  }, [toast]);


  // --- Skill Proficiency Logic ---
  const selectedClass = useMemo(() => localAvailableClasses.find(c => c.name === form.watch('class')), [localAvailableClasses, form.watch('class')]);
  const selectedBackgroundName = form.watch('background');

  // Fetch background details when background name changes
   const { data: backgroundDetails } = useQuery<{ name: string; skillProficiencies: string[], toolProficiencies?: string[] } | null, Error>({
      queryKey: ['backgroundDetails', selectedBackgroundName],
      queryFn: () => selectedBackgroundName ? getBackgroundDetails(selectedBackgroundName) : Promise.resolve(null),
      enabled: !!selectedBackgroundName,
      staleTime: Infinity, // Background data is static
  });


  // Automatically update skill proficiencies based on class and background
   useEffect(() => {
       const currentSkills = { ...form.getValues('skills') }; // Get current selections
       const newSkills = ALL_SKILLS.reduce((acc, skill) => {
           acc[skill] = false; // Start fresh
           return acc;
       }, {} as Record<string, boolean>);

       let classChoicesMade = 0;
       const classSkillOptions = selectedClass?.proficiencies?.skills?.options ?? [];
       const numClassChoices = selectedClass?.proficiencies?.skills?.choose ?? 0;

       // Apply background proficiencies first (cannot be unselected)
       backgroundDetails?.skillProficiencies.forEach(skill => {
           if (ALL_SKILLS.includes(skill.toLowerCase())) {
               newSkills[skill.toLowerCase()] = true;
           }
       });

       // Re-apply existing *class* choices if they are still valid
       classSkillOptions.forEach(skillOption => {
            const skillKey = skillOption.toLowerCase();
            if (currentSkills[skillKey] && !newSkills[skillKey] && classChoicesMade < numClassChoices) {
                newSkills[skillKey] = true;
                classChoicesMade++;
            }
       });

        // // Set any remaining previously selected non-background/non-class skills (usually none)
        // ALL_SKILLS.forEach(skill => {
        //     if (currentSkills[skill] && !newSkills[skill] && !classSkillOptions.includes(skill) && !(backgroundDetails?.skillProficiencies.includes(skill))) {
        //         newSkills[skill] = true;
        //     }
        // });


        // // Only update if skills actually changed to prevent loops
        // // NOTE: Comparing objects directly might not work as expected. Deep comparison or stringify needed.
        // // For simplicity, always update if class or background changes. Consider optimizing if performance issues arise.
        // // if (JSON.stringify(newSkills) !== JSON.stringify(form.getValues('skills'))) {
           form.setValue('skills', newSkills, { shouldValidate: true, shouldDirty: true });
        // }

   }, [selectedClass, backgroundDetails, form.setValue, form.getValues]); // Dependencies: class and background


   // Get skill choices for the selected class
  const classSkillChoice = useMemo(() => {
    if (!selectedClass?.proficiencies?.skills) return null;
    return {
      choose: selectedClass.proficiencies.skills.choose,
      options: selectedClass.proficiencies.skills.options.map(s => s.toLowerCase()), // Ensure lowercase for comparison
    };
  }, [selectedClass]);

    const handleSkillChange = (skill: string, checked: boolean) => {
        if (!classSkillChoice || !classSkillChoice.options.includes(skill)) return; // Can only change class options

        const currentSkills = form.getValues('skills');
        const numSelected = classSkillChoice.options.filter(opt => currentSkills[opt]).length;

        if (checked && numSelected >= classSkillChoice.choose) {
            toast({
                variant: 'destructive',
                title: 'Too Many Skills',
                description: `You can only choose ${classSkillChoice.choose} skills from your class list.`,
            });
            return; // Prevent selecting more than allowed
        }

        form.setValue(`skills.${skill}`, checked, { shouldValidate: true, shouldDirty: true });
    };



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

    // --- Validate Skill Selections ---
     if (classSkillChoice) {
         const selectedClassSkills = classSkillChoice.options.filter(opt => data.skills[opt]).length;
         if (selectedClassSkills !== classSkillChoice.choose) {
             form.setError('skills', { type: 'manual', message: `Please select exactly ${classSkillChoice.choose} skills from your class list.` });
             toast({ variant: 'destructive', title: 'Skill Selection Error', description: `Please select exactly ${classSkillChoice.choose} class skills.` });
             setIsLoading(false);
             return;
         }
     }


    // --- Derive missing character properties ---
    const selectedClassData = localAvailableClasses.find(c => c.name === data.class);
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
      ? {
          max: maxHp,
          current: Math.min(initialData.hitPoints.current, maxHp),
          temporary: initialData.hitPoints.temporary || 0,
        }
      : {
          max: maxHp,
          current: maxHp,
          temporary: 0,
        };

    const hitDice: HitDiceState = {
      total: data.level,
      remaining: isEditing && initialData?.hitDice ? Math.min(initialData.hitDice.remaining, data.level) : data.level,
      dieType: selectedClassData.hitDie,
    };


    // 2. Proficiencies (Combine class and race - simplified for now)
     const proficiencies = {
         armor: selectedClassData.proficiencies.armor ?? [],
         weapons: selectedClassData.proficiencies.weapons ?? [],
         tools: selectedClassData.proficiencies.tools ?? [],
         savingThrows: selectedClassData.proficiencies.savingThrows ?? [],
         // Skills are derived from the form's skills state
     };
     // Add background tool proficiencies
      if (backgroundDetails?.toolProficiencies) {
          proficiencies.tools = [...new Set([...proficiencies.tools, ...backgroundDetails.toolProficiencies])];
      }

    // 3. Features (Fetch based on final class/race/level)
    let features: Feature[] = [];
    try {
        const [classFeats, raceFeats] = await Promise.all([
            getCumulativeClassFeatures(data.class, data.level),
            getRaceTraitsDetails(selectedRaceData.traits),
        ]);
         const combined = [...raceFeats, ...classFeats];
         const uniqueFeatureNames = new Set<string>();
         features = combined.filter(feat => {
             if (!uniqueFeatureNames.has(feat.name)) {
                 uniqueFeatureNames.add(feat.name);
                 return true;
             }
             return false;
         });

         features = features.map(feat => ({
            ...feat,
            currentUses: feat.maxUses !== null && feat.maxUses !== undefined ? feat.maxUses : undefined,
         }));

    } catch (error) {
        console.error("Failed to fetch features during save:", error);
        toast({ variant: "destructive", title: "Feature Error", description: "Could not fetch all character features. Saving without full feature list." });
    }


    const finalEquipment = data.equipment?.map(item => ({
        ...item,
        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
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
      skills: data.skills,
      hitPoints: hitPoints,
      hitDice: hitDice,
      equipment: finalEquipment,
      proficiencies: proficiencies,
      features: features,
      backstory: data.backstory || '',
      appearance: data.appearance || '',
    };

    try {
      if (isEditing && initialData?.id) {
        const existingFeaturesMap = new Map(initialData.features.map(f => [f.name, f.currentUses]));
        const updatedFeaturesWithPreservedUses = characterToSave.features.map(f => ({
            ...f,
            currentUses: existingFeaturesMap.get(f.name) ?? f.currentUses,
        }));

        await updateCharacter(initialData.id, {
          ...characterToSave,
          features: updatedFeaturesWithPreservedUses
        });
        toast({ title: 'Character Updated', description: `${data.characterName} has been successfully updated.` });
        router.push(`/character/view/${initialData.id}`);
      } else {
        const newId = await saveCharacter(characterToSave);
        toast({ title: 'Character Created', description: `${data.characterName} has been successfully created.` });
        router.push(`/character/view/${newId}`);
      }
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

  if (apiError && !isLoading) {
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
                          {localAvailableClasses.map((cls) => (
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
            {/* TODO: Replace with Select dropdown populated from fetched backgrounds */}
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
                <CardTitle className='flex items-center gap-2'>
                    Skills
                     {classSkillChoice && (
                          <Popover>
                            <PopoverTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
                                   <Info className="h-4 w-4" />
                               </Button>
                            </PopoverTrigger>
                            <PopoverContent className="text-sm w-auto max-w-xs">
                               <p>Your background grants proficiency in: <strong>{backgroundDetails?.skillProficiencies.join(', ') || 'None'}</strong>.</p>
                               <p className='mt-2'>Your class (<strong className='capitalize'>{selectedClass?.name}</strong>) allows you to choose <strong>{classSkillChoice.choose}</strong> more from: {classSkillChoice.options.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}.</p>
                           </PopoverContent>
                        </Popover>
                    )}
                 </CardTitle>
                <p className="text-sm text-muted-foreground">Select skills to be proficient in.</p>
                 {form.formState.errors.skills && <Alert variant="destructive" className="mt-2"><AlertCircle className="h-4 w-4" /><AlertDescription>{form.formState.errors.skills.message}</AlertDescription></Alert>}
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                {ALL_SKILLS.map((skill) => {
                    const isBackgroundSkill = backgroundDetails?.skillProficiencies.some(bs => bs.toLowerCase() === skill);
                    const isClassOption = classSkillChoice?.options.includes(skill);
                    const isDisabled = isBackgroundSkill || !isClassOption; // Disable background skills and non-class options
                    const ability = SKILL_ABILITY_MAP[skill];

                    return (
                        <div key={skill} className="flex items-center space-x-2">
                           <Controller
                               name={`skills.${skill}`}
                               control={form.control}
                               render={({ field }) => (
                                    <Checkbox
                                        id={`skill-${skill}`}
                                        checked={field.value}
                                        onCheckedChange={(checked) => handleSkillChange(skill, Boolean(checked))}
                                        disabled={isDisabled}
                                        aria-labelledby={`skill-label-${skill}`}
                                    />
                               )}
                            />
                           <Label htmlFor={`skill-${skill}`} id={`skill-label-${skill}`} className={cn("capitalize text-sm font-normal cursor-pointer", isDisabled && !isBackgroundSkill && "text-muted-foreground", isBackgroundSkill && "font-medium")}>
                               {skill} <span className='text-xs text-muted-foreground ml-1'>({ability.substring(0, 3)})</span>
                                {isBackgroundSkill && <Badge variant="secondary" className="ml-1 text-xs">BG</Badge>}
                           </Label>
                       </div>
                    )
                })}
            </CardContent>
        </Card>


      {/* --- Equipment (Simplified for form) --- */}
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
                     onClick={() => appendEquipment({ name: '', quantity: 1, description: '', isEquipped: false })}
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
         <Button type="submit" disabled={isLoading || !form.formState.isValid}>
           {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
           {isEditing ? 'Update Character' : 'Create Character'}
         </Button>
      </div>
    </form>
  );
}
