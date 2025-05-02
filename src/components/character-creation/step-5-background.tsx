
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { ALL_SKILLS, type SourcePack, type BackgroundInfo } from '@/lib/types';
import { getBackgroundDetails, getAvailableBackgrounds } from '@/services/dnd-api'; // Updated import

// Simplified Zod schema for validation within this step
const step5Schema = z.object({
    background: z.string().min(1, "Background selection is required"),
    personalityTrait: z.string().optional(),
    ideal: z.string().optional(),
    bond: z.string().optional(),
    flaw: z.string().optional(),
});

type Step5FormData = z.infer<typeof step5Schema>;

interface Step5Props {
    data: PartialCharacterFormData;
    updateData: (data: Partial<PartialCharacterFormData>) => void;
    setValidity: (isValid: boolean) => void;
    combinedContent?: SourcePack['content']; // Keep for potential future use or merging logic
}

export function Step5Background({ data, updateData, setValidity, combinedContent }: Step5Props) {
    const { register, watch, setValue, getValues, formState: { errors, isValid: formIsValid }, control } = useForm<Step5FormData>({
         resolver: zodResolver(step5Schema),
         mode: 'onChange',
         defaultValues: {
             background: data.background || '',
             personalityTrait: data.backstory?.split('\n---\n')[0].replace('Trait: ', '') || '',
             ideal: data.backstory?.split('\n---\n')[1]?.replace('Ideal: ', '') || '',
             bond: data.backstory?.split('\n---\n')[2]?.replace('Bond: ', '') || '',
             flaw: data.backstory?.split('\n---\n')[3]?.replace('Flaw: ', '') || '',
         }
    });

    const selectedBgName = watch('background');
    const watchedPersonality = watch(['personalityTrait', 'ideal', 'bond', 'flaw']);

     // Fetch available background names from the API
     const { data: availableBackgroundNames = [], isLoading: isLoadingNames } = useQuery<string[], Error>({
        queryKey: ['availableBackgrounds'],
        queryFn: getAvailableBackgrounds, // Fetch directly from API
        staleTime: Infinity, // Background names are fairly static
    });

    // Fetch background details for the selected background
    const { data: currentBgData, isLoading: isLoadingBgDetails } = useQuery<BackgroundInfo | null, Error>({
        queryKey: ['backgroundDetails', selectedBgName, combinedContent], // Still include combinedContent in case API uses it
        queryFn: () => selectedBgName ? getBackgroundDetails(selectedBgName, combinedContent) : Promise.resolve(null),
        enabled: !!selectedBgName, // Fetch when a background is selected
        staleTime: 5 * 60 * 1000, // Cache details for 5 mins
    });


    useEffect(() => {
        const isLoading = isLoadingNames || isLoadingBgDetails;
        // Update Validity
        setValidity(!!selectedBgName && formIsValid && !isLoading); // Also check loading states

        // Calculate Derived Update Data
        const backstoryString = [
            `Trait: ${watchedPersonality[0] || 'None'}`,
            `Ideal: ${watchedPersonality[1] || 'None'}`,
            `Bond: ${watchedPersonality[2] || 'None'}`,
            `Flaw: ${watchedPersonality[3] || 'None'}`
        ].join('\n---\n');

        // Start with existing skills/proficiencies and remove old background ones
        // Note: This logic might need refinement if multiple sources grant the same proficiency.
        // For now, we simply remove old background ones and add new ones.
        const baseSkills = { ...(data.skills || {}) };
        const baseProficiencies = {
            armor: [...(data.tempProficiencies?.armor ?? [])],
            weapons: [...(data.tempProficiencies?.weapons ?? [])],
            tools: [...(data.tempProficiencies?.tools?.filter(p => !p.endsWith('(Background)')) ?? [])], // Remove old background tools
            savingThrows: [...(data.tempProficiencies?.savingThrows ?? [])],
        };

         // Remove skills potentially granted by the *previous* background
         // This is tricky without knowing the *exact* previous background's skills.
         // We assume background skills were marked or clear the slate if selection changed.
         // A safer approach: filter out *all* potential background skills before adding new ones.
         // For simplicity here, we assume the final save calculation will handle duplicates.
         const newSkills = { ...baseSkills };
         const newProficiencies = { ...baseProficiencies };


        if (currentBgData) {
             // Add skill proficiencies from the current background
            (currentBgData.skillProficiencies || []).forEach(skill => {
                 const skillLower = skill.toLowerCase();
                 if (ALL_SKILLS.includes(skillLower)) {
                     newSkills[skillLower] = true;
                 } else {
                     console.warn(`Background skill "${skill}" not found in standard skills list.`);
                 }
             });
             // Add tool proficiencies
             if (currentBgData.toolProficiencies) {
                newProficiencies.tools = [...new Set([...newProficiencies.tools, ...currentBgData.toolProficiencies.map(p => `${p} (Background)`)])];
             }
             // TODO: Handle language choices if applicable
        }

        const updatePayload: Partial<PartialCharacterFormData> = {
            background: selectedBgName || '',
            backstory: backstoryString,
            skills: newSkills,
            tempProficiencies: newProficiencies,
            // Persist chosen languages/skill choices from background here if implemented
        };

        // Compare relevant parts before updating
        const backgroundChanged = updatePayload.background !== data.background;
        const backstoryChanged = updatePayload.backstory !== data.backstory;
        const skillsChanged = JSON.stringify(updatePayload.skills) !== JSON.stringify(data.skills);
        const proficienciesChanged = JSON.stringify(updatePayload.tempProficiencies) !== JSON.stringify(data.tempProficiencies);

        if (backgroundChanged || backstoryChanged || skillsChanged || proficienciesChanged) {
            console.log("Step 5: Updating parent data");
            updateData(updatePayload);
        }

    }, [
        selectedBgName,
        formIsValid,
        isLoadingNames,
        isLoadingBgDetails,
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

    const isLoading = isLoadingNames || isLoadingBgDetails;

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
                                    // Use || "" to handle potential undefined/null from field.value but avoid passing it directly
                                    value={field.value || ""}
                                    onValueChange={(value) => field.onChange(value)}
                                    // Disable while loading names
                                    disabled={isLoadingNames}
                                >
                                    <SelectTrigger id="background-select" className={isLoadingNames ? 'animate-pulse' : ''}>
                                        <SelectValue placeholder={isLoadingNames ? "Loading..." : "Choose a background..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                         {availableBackgroundNames.length === 0 && !isLoadingNames && (
                                             <SelectItem value="" disabled>No backgrounds found</SelectItem>
                                         )}
                                         {availableBackgroundNames.map(bgName => (
                                            <SelectItem key={bgName} value={bgName}>{bgName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                       />
                        {errors.background && <p className="text-xs text-destructive mt-1">{errors.background.message}</p>}

                        {isLoadingBgDetails && selectedBgName && <Skeleton className="h-20 w-full mt-4" />}
                        {!isLoadingBgDetails && currentBgData && (
                             <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground">{currentBgData.name}</p>
                                <p>{currentBgData.description}</p>
                                {currentBgData.skillProficiencies?.length > 0 && <p><strong>Skills:</strong> {currentBgData.skillProficiencies.join(', ')}</p>}
                                {currentBgData.toolProficiencies?.length > 0 && <p><strong>Tools:</strong> {currentBgData.toolProficiencies.join(', ')}</p>}
                                {currentBgData.languages && <p><strong>Languages:</strong> Choose {currentBgData.languages.choose}</p>}
                                {currentBgData.feature && <p><strong>Feature:</strong> {currentBgData.feature.name}</p>}
                             </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Personality Traits */}
            <div className="md:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Personality</CardTitle>
                        <CardDescription>Define your character's personality traits, ideals, bonds, and flaws. You can select from suggestions or write your own.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-1">
                             <Label htmlFor="personalityTrait" className="flex justify-between items-center">
                                 <span>Personality Trait</span>
                                  <Button type="button" variant="ghost" size="xs" onClick={() => randomizeField('personalityTrait', currentBgData?.suggestedTraits)} disabled={!selectedBgName || isLoadingBgDetails || !currentBgData?.suggestedTraits}>
                                      <Dices className="h-3 w-3 mr-1" /> Randomize
                                  </Button>
                             </Label>
                             <Textarea id="personalityTrait" {...register('personalityTrait')} rows={2} placeholder="Describe a personality trait..." />
                         </div>
                          <div className="space-y-1">
                              <Label htmlFor="ideal" className="flex justify-between items-center">
                                  <span>Ideal</span>
                                   <Button type="button" variant="ghost" size="xs" onClick={() => randomizeField('ideal', currentBgData?.suggestedIdeals)} disabled={!selectedBgName || isLoadingBgDetails || !currentBgData?.suggestedIdeals}>
                                       <Dices className="h-3 w-3 mr-1" /> Randomize
                                   </Button>
                              </Label>
                              <Textarea id="ideal" {...register('ideal')} rows={1} placeholder="Describe an ideal..." />
                          </div>
                           <div className="space-y-1">
                               <Label htmlFor="bond" className="flex justify-between items-center">
                                   <span>Bond</span>
                                    <Button type="button" variant="ghost" size="xs" onClick={() => randomizeField('bond', currentBgData?.suggestedBonds)} disabled={!selectedBgName || isLoadingBgDetails || !currentBgData?.suggestedBonds}>
                                        <Dices className="h-3 w-3 mr-1" /> Randomize
                                    </Button>
                               </Label>
                               <Textarea id="bond" {...register('bond')} rows={1} placeholder="Describe a bond..." />
                           </div>
                            <div className="space-y-1">
                                <Label htmlFor="flaw" className="flex justify-between items-center">
                                    <span>Flaw</span>
                                     <Button type="button" variant="ghost" size="xs" onClick={() => randomizeField('flaw', currentBgData?.suggestedFlaws)} disabled={!selectedBgName || isLoadingBgDetails || !currentBgData?.suggestedFlaws}>
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
