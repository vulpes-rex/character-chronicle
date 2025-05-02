
'use client';

import { useState, useEffect, useMemo } from 'react'; // Keep useMemo for potential future optimizations
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useQuery } from '@tanstack/react-query';
import { Dices } from 'lucide-react';
import type { PartialCharacterFormData } from './character-creation-wizard';
import { ALL_SKILLS } from '@/lib/types'; // Import skill list
import { getBackgroundDetails } from '@/services/dnd-api'; // Import API function

// Mock Background Data (Replace with API call if not already done)
const MOCK_BACKGROUNDS = [
    {
        name: "Acolyte",
        description: "You have spent your life in the service of a temple...",
        skillProficiencies: ["Insight", "Religion"],
        languages: { choose: 2, options: ["Celestial", "Infernal", "Abyssal", "Common", "Elvish", "Dwarvish"] }, // Example language options
        equipment: ["Holy symbol", "Prayer book", "5 sticks of incense", "Vestments", "Common clothes", "Belt pouch containing 15 gp"],
        feature: { name: "Shelter of the Faithful", description: "..." },
        traits: ["I idolize a particular hero of my faith...", "I quote sacred texts...", "I am tolerant/intolerant...", "I enjoy fine food/drink...", "My piety is unshakable...", "I question the teachings...", "I seek to prove myself...", "I see omens in every event..."],
        ideals: ["Tradition.", "Charity.", "Change.", "Power.", "Faith.", "Aspiration."],
        bonds: ["I would die to recover an ancient relic...", "I owe my life to the priest...", "Everything I do is for the common people...", "I will do anything to protect the temple...", "I seek vengeance on the corrupt temple hierarchy...", "I secretly love someone related to my faith..."],
        flaws: ["I judge others harshly...", "I put too much trust in those who wield power...", "My piety sometimes leads me to blindly trust...", "I am inflexible in my thinking...", "I am suspicious of strangers...", "Once I pick a goal, I become obsessed..."]
    },
    {
        name: "Urchin",
        description: "You grew up on the streets alone, orphaned, or abandoned...",
        skillProficiencies: ["Sleight of Hand", "Stealth"],
        toolProficiencies: ["Disguise kit", "Thieves' tools"],
        equipment: ["Small knife", "Map of the city", "Pet mouse", "Token", "Common clothes", "Belt pouch containing 10 gp"],
        feature: { name: "City Secrets", description: "..." },
        traits: ["I hide scraps of food...", "I ask a lot of questions...", "I like to squeeze into small places...", "I sleep with my back to a wall...", "I mimic others' speech...", "I pretend I can't speak...", "I assume the worst...", "I find it hard to trust..."],
        ideals: ["Respect.", "Community.", "Change.", "Retribution.", "People.", "Aspiration."],
        bonds: ["My town or city is my home...", "I sponsor an orphanage...", "I owe my survival to another urchin...", "I escaped my life of poverty...", "A kindred spirit took pity on me...", "I am guilty of a terrible crime..."],
        flaws: ["If I'm outnumbered, I run...", "Gold seems like a lot of money...", "I will never fully trust anyone...", "I'd rather kill someone in their sleep...", "I think anyone who is nice has ulterior motives...", "I ruthlessly exploit others..."]
    },
     {
         name: "Soldier",
         description: "War has been your life for as long as you care to remember...",
         skillProficiencies: ["Athletics", "Intimidation"],
         toolProficiencies: ["One type of gaming set", "Vehicles (land)"],
         equipment: ["Insignia of rank", "Trophy", "Set of bone dice or deck of cards", "Common clothes", "Belt pouch containing 10 gp"],
         feature: { name: "Military Rank", description: "..." },
         traits: ["I'm always polite and respectful...", "I'm haunted by memories of war...", "I've lost too many friends...", "I'm full of inspiring stories...", "I can stare down a hell hound...", "I enjoy being strong...", "I have a crude sense of humor...", "I face problems head-on..."],
         ideals: ["Greater Good.", "Responsibility.", "Independence.", "Might.", "Live and Let Live.", "Nation."],
         bonds: ["I would still lay down my life for the people I served with...", "Someone saved my life on the battlefield...", "My honor is my life...", "I'll never forget the crushing defeat...", "Those who fight beside me are those worth dying for...", "I fight for those who cannot fight for themselves..."],
         flaws: ["The monstrous enemy we faced still chills me...", "I have little respect for those who are not proven warriors...", "I made a terrible mistake in battle...", "My hatred of my enemies is blind and unreasoning...", "I obey the law, even if the law causes misery...", "I'd rather eat my armor than admit when I'm wrong..."]
     }
    // Add more backgrounds
];

// Simple Zod schema for validation within this step
const step5Schema = z.object({
    background: z.string().min(1, "Background selection is required"),
    // Add validation for language/skill choices if applicable to the selected background
    personalityTrait: z.string().optional(),
    ideal: z.string().optional(),
    bond: z.string().optional(),
    flaw: z.string().optional(),
    // Add selected languages/skills if needed
});

type Step5FormData = z.infer<typeof step5Schema>;

interface Step5Props {
    data: PartialCharacterFormData;
    updateData: (data: Partial<PartialCharacterFormData>) => void;
    setValidity: (isValid: boolean) => void;
}

export function Step5Background({ data, updateData, setValidity }: Step5Props) {
    // Use react-hook-form for managing local state of this step (traits, ideals, etc.)
    const { register, watch, setValue, getValues, formState: { errors, isValid: formIsValid }, control } = useForm<Step5FormData>({ // Added control
         resolver: zodResolver(step5Schema),
         mode: 'onChange',
         defaultValues: {
             background: data.background || '',
             // Initialize personality fields from combined backstory or defaults
             personalityTrait: data.backstory?.split('\n---\n')[0].replace('Trait: ', '') || '',
             ideal: data.backstory?.split('\n---\n')[1]?.replace('Ideal: ', '') || '',
             bond: data.backstory?.split('\n---\n')[2]?.replace('Bond: ', '') || '',
             flaw: data.backstory?.split('\n---\n')[3]?.replace('Flaw: ', '') || '',
         }
    });

    const selectedBgName = watch('background');
    const watchedPersonality = watch(['personalityTrait', 'ideal', 'bond', 'flaw']); // Watch personality fields

    // Use query for background details (optional, can also use MOCK_BACKGROUNDS directly)
    const { data: selectedBgData, isLoading: isLoadingBgDetails } = useQuery({
        queryKey: ['backgroundDetails', selectedBgName],
        queryFn: () => selectedBgName ? getBackgroundDetails(selectedBgName) : Promise.resolve(null),
        enabled: !!selectedBgName,
        staleTime: Infinity,
    });
    // Fallback to mock data if API fails or is not used
    const currentBgData = selectedBgData || MOCK_BACKGROUNDS.find(bg => bg.name === selectedBgName);


    // Update parent data and validity when selection or form fields change
    useEffect(() => {
        // Update Validity
        setValidity(!!selectedBgName && formIsValid);

        // Calculate Derived Update Data inside the effect
        const backstoryString = [
            `Trait: ${watchedPersonality[0] || 'None'}`,
            `Ideal: ${watchedPersonality[1] || 'None'}`,
            `Bond: ${watchedPersonality[2] || 'None'}`,
            `Flaw: ${watchedPersonality[3] || 'None'}`
        ].join('\n---\n'); // Use a separator

        const newSkills = { ...(data.skills || {}) };
        const newProficiencies = {
            armor: [...(data.tempProficiencies?.armor ?? [])],
            weapons: [...(data.tempProficiencies?.weapons ?? [])],
            tools: [...(data.tempProficiencies?.tools?.filter(p => !p.endsWith('(Background)')) ?? [])], // Remove old background tools
            savingThrows: [...(data.tempProficiencies?.savingThrows ?? [])],
        };

        if (currentBgData) {
            // Add skill proficiencies
            currentBgData.skillProficiencies.forEach(skill => {
                 // Ensure skill exists in ALL_SKILLS before marking true
                 const skillLower = skill.toLowerCase();
                 if (ALL_SKILLS.includes(skillLower)) {
                     newSkills[skillLower] = true; // Mark as proficient
                 } else {
                     console.warn(`Background skill "${skill}" not found in standard skills list.`);
                 }
             });
             // Add tool proficiencies
             if (currentBgData.toolProficiencies) {
                newProficiencies.tools = [...new Set([...newProficiencies.tools, ...currentBgData.toolProficiencies.map(p => `${p} (Background)`)])];
             }
        }

        const updatePayload: Partial<PartialCharacterFormData> = {
            background: selectedBgName || '',
            backstory: backstoryString,
            skills: newSkills,
            tempProficiencies: newProficiencies,
        };

        // Compare specific parts of the state to decide if an update is needed
        const backgroundChanged = updatePayload.background !== data.background;
        const backstoryChanged = updatePayload.backstory !== data.backstory;
        const skillsChanged = JSON.stringify(updatePayload.skills) !== JSON.stringify(data.skills);
        const proficienciesChanged = JSON.stringify(updatePayload.tempProficiencies) !== JSON.stringify(data.tempProficiencies);

        if (backgroundChanged || backstoryChanged || skillsChanged || proficienciesChanged) {
            console.log("Step 5: Updating parent data"); // Debug log
            updateData(updatePayload);
        }

    // Depend on the states that directly influence the calculation and validity.
    // Also depend on the stable callback functions.
    // Include relevant parts of `data` used in comparison.
    }, [
        selectedBgName,
        formIsValid,
        watchedPersonality,
        currentBgData,
        setValidity,
        updateData,
        data.background,
        data.backstory,
        data.skills,
        data.tempProficiencies
    ]);


    const randomizeField = (fieldName: keyof Step5FormData, options?: string[]) => {
        if (options && options.length > 0) {
            const randomIndex = Math.floor(Math.random() * options.length);
            setValue(fieldName, options[randomIndex], { shouldValidate: true, shouldDirty: true });
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Background Selection & Details */}
            <div className="md:col-span-1 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Select Background</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <Controller
                           name="background"
                           control={control}
                           render={({ field }) => (
                                <Select
                                    value={field.value ?? ""}
                                    onValueChange={(value) => {
                                         field.onChange(value);
                                         // Optionally reset personality fields when background changes
                                         // setValue('personalityTrait', '');
                                         // setValue('ideal', '');
                                         // setValue('bond', '');
                                         // setValue('flaw', '');
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a background..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MOCK_BACKGROUNDS.map(bg => ( // Use mock or fetched list here
                                            <SelectItem key={bg.name} value={bg.name}>{bg.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                       />
                        {errors.background && <p className="text-xs text-destructive mt-1">{errors.background.message}</p>}

                        {isLoadingBgDetails && <Skeleton className="h-20 w-full mt-4" />}
                        {!isLoadingBgDetails && currentBgData && (
                             <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground">{currentBgData.name}</p>
                                <p>{currentBgData.description}</p>
                                <p><strong>Skills:</strong> {currentBgData.skillProficiencies.join(', ')}</p>
                                {currentBgData.toolProficiencies && <p><strong>Tools:</strong> {currentBgData.toolProficiencies.join(', ')}</p>}
                                {currentBgData.languages && <p><strong>Languages:</strong> Choose {currentBgData.languages.choose}</p>}
                                {currentBgData.feature && <p><strong>Feature:</strong> {currentBgData.feature.name}</p>}
                             </div>
                        )}
                    </CardContent>
                </Card>
                {/* TODO: Add Language/Skill Choice Section if applicable */}
            </div>

            {/* Personality Traits */}
            <div className="md:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Personality</CardTitle>
                        <CardDescription>Define your character's personality traits, ideals, bonds, and flaws. You can select from suggestions or write your own.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         {/* Trait */}
                         <div className="space-y-1">
                             <Label htmlFor="personalityTrait" className="flex justify-between items-center">
                                 <span>Personality Trait</span>
                                  <Button type="button" variant="ghost" size="xs" onClick={() => randomizeField('personalityTrait', currentBgData?.traits)} disabled={!currentBgData?.traits}>
                                      <Dices className="h-3 w-3 mr-1" /> Randomize
                                  </Button>
                             </Label>
                             <Textarea id="personalityTrait" {...register('personalityTrait')} rows={2} placeholder="Describe a personality trait..." />
                         </div>
                          {/* Ideal */}
                          <div className="space-y-1">
                              <Label htmlFor="ideal" className="flex justify-between items-center">
                                  <span>Ideal</span>
                                   <Button type="button" variant="ghost" size="xs" onClick={() => randomizeField('ideal', currentBgData?.ideals)} disabled={!currentBgData?.ideals}>
                                       <Dices className="h-3 w-3 mr-1" /> Randomize
                                   </Button>
                              </Label>
                              <Textarea id="ideal" {...register('ideal')} rows={1} placeholder="Describe an ideal..." />
                          </div>
                           {/* Bond */}
                           <div className="space-y-1">
                               <Label htmlFor="bond" className="flex justify-between items-center">
                                   <span>Bond</span>
                                    <Button type="button" variant="ghost" size="xs" onClick={() => randomizeField('bond', currentBgData?.bonds)} disabled={!currentBgData?.bonds}>
                                        <Dices className="h-3 w-3 mr-1" /> Randomize
                                    </Button>
                               </Label>
                               <Textarea id="bond" {...register('bond')} rows={1} placeholder="Describe a bond..." />
                           </div>
                            {/* Flaw */}
                            <div className="space-y-1">
                                <Label htmlFor="flaw" className="flex justify-between items-center">
                                    <span>Flaw</span>
                                     <Button type="button" variant="ghost" size="xs" onClick={() => randomizeField('flaw', currentBgData?.flaws)} disabled={!currentBgData?.flaws}>
                                         <Dices className="h-3 w-3 mr-1" /> Randomize
                                     </Button>
                                </Label>
                                <Textarea id="flaw" {...register('flaw')} rows={1} placeholder="Describe a flaw..." />
                            </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

