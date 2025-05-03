
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
import { Dices, CheckSquare, Square, AlertCircle } from 'lucide-react'; // Added Checkbox icons & AlertCircle
import type { PartialCharacterFormData } from './character-creation-wizard';
import { ALL_SKILLS, type SourcePack, type BackgroundInfo, Feature } from '@/lib/types';
import { getAvailableBackgrounds, getBackgroundDetails } from '@/services/dnd-api'; // Keep for names and suggestions
import { getBackgroundFeatures } from '@/services/feature-service'; // Use feature service for actual features
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'; // Import Alert components


// Simplified Zod schema for validation within this step
const step5Schema = z.object({
    background: z.string().min(1, "Background selection is required"),
    personalityTrait: z.string().optional(),
    ideal: z.string().optional(),
    bond: z.string().optional(),
    flaw: z.string().optional(),
    // Add fields for chosen skills/tools/languages if background offers choices
    // e.g., languageChoices: z.array(z.string()).optional(),
    // e.g., skillChoices: z.array(z.string()).optional(),
});

type Step5FormData = z.infer<typeof step5Schema>;

interface Step5Props {
    data: PartialCharacterFormData;
    updateData: (data: Partial<PartialCharacterFormData>) => void;
    setValidity: (isValid: boolean) => void;
    combinedContent?: SourcePack['content']; // For looking up definitions
}

export function Step5Background({ data, updateData, setValidity, combinedContent }: Step5Props) {
    const { register, watch, setValue, getValues, formState: { errors, isValid: formIsValid }, control } = useForm<Step5FormData>({
         resolver: zodResolver(step5Schema),
         mode: 'onChange',
         defaultValues: {
             background: data.background || '',
             personalityTrait: data.backstory?.split('\n---\n')[0]?.replace('Trait: ', '') || '',
             ideal: data.backstory?.split('\n---\n')[1]?.replace('Ideal: ', '') || '',
             bond: data.backstory?.split('\n---\n')[2]?.replace('Bond: ', '') || '',
             flaw: data.backstory?.split('\n---\n')[3]?.replace('Flaw: ', '') || '',
             // Initialize choices based on data.featureChoices if applicable
         }
    });

    const selectedBgName = watch('background');
    const watchedPersonality = watch(['personalityTrait', 'ideal', 'bond', 'flaw']);

     // Fetch available background names from the API (still useful for the dropdown)
     const { data: availableBackgroundNames = [], isLoading: isLoadingNames } = useQuery<string[], Error>({
        queryKey: ['availableBackgrounds', combinedContent], // Include content in key if names depend on it
        queryFn: () => getAvailableBackgrounds(combinedContent),
        staleTime: 5 * 60 * 1000, // Cache names
    });

    // Fetch background details for suggestions (optional, but helpful)
    const { data: currentBgData, isLoading: isLoadingBgDetails } = useQuery<BackgroundInfo | null, Error>({
        queryKey: ['backgroundDetails', selectedBgName, combinedContent], // Use combinedContent
        queryFn: () => selectedBgName ? getBackgroundDetails(selectedBgName, combinedContent) : Promise.resolve(null),
        enabled: !!selectedBgName,
        staleTime: 5 * 60 * 1000,
    });

     // Fetch actual background *features* using the feature service
     const { data: backgroundFeatures, isLoading: isLoadingBgFeatures } = useQuery<Feature[], Error>({
        queryKey: ['backgroundFeatures', selectedBgName, combinedContent], // Use combinedContent
        // Pass combinedContent to getBackgroundFeatures
        queryFn: () => selectedBgName ? getBackgroundFeatures(selectedBgName, combinedContent) : Promise.resolve([]),
        enabled: !!selectedBgName,
        staleTime: 5 * 60 * 1000,
    });


    useEffect(() => {
        const isLoading = isLoadingNames || isLoadingBgDetails || isLoadingBgFeatures;
        // Update Validity - Validity now also depends on required choices being made
        // For now, just based on background selection and loading state. Add choice validation later.
        setValidity(!!selectedBgName && formIsValid && !isLoading);

        // --- Prepare Update Payload ---
        const backstoryString = [
            `Trait: ${watchedPersonality[0] || 'None'}`,
            `Ideal: ${watchedPersonality[1] || 'None'}`,
            `Bond: ${watchedPersonality[2] || 'None'}`,
            `Flaw: ${watchedPersonality[3] || 'None'}`
        ].join('\n---\n');

        // Initialize skills/choices based on current character data before applying new background
        const newSkills = { ...(data.skills || {}) };
        const newFeatureChoices = { ...(data.featureChoices || {}) };

         // Process features granted by the currently selected background
         if (backgroundFeatures) {
             backgroundFeatures.forEach(feature => {
                 // Apply skill proficiencies directly
                  if (feature.metadata?.effectType === 'proficiencyGrant' && feature.metadata.type === 'skill' && !feature.metadata.choose) {
                     (feature.metadata.proficiencies || []).forEach(skill => {
                         const skillLower = skill.toLowerCase();
                         if (ALL_SKILLS.includes(skillLower)) {
                             newSkills[skillLower] = true;
                         } else {
                             console.warn(`Background feature "${feature.name}" grants unknown skill: "${skill}"`);
                         }
                     });
                  }
                 // Handle language/tool choices (Store choices in newFeatureChoices)
                 // TODO: This part needs UI elements (dropdowns/checkboxes) linked to the form state
                 // to actually capture player choices before saving them here.
                 if (feature.metadata?.effectType === 'proficiencyGrant' && feature.metadata.choose && feature.metadata.choiceKey) {
                      const choiceKey = feature.metadata.choiceKey;
                      // Example: Assume form value 'languageChoices' exists and holds selected languages
                      // const chosenLangs = getValues('languageChoices'); // Needs Controller/register
                      // newFeatureChoices[choiceKey] = chosenLangs || [];
                 }
             });
        }

        const updatePayload: Partial<PartialCharacterFormData> = {
            background: selectedBgName || '',
            backstory: backstoryString,
            skills: newSkills, // Skills potentially updated by background
            featureChoices: newFeatureChoices, // Store choices made for background features
            // Note: Tool/Language proficiencies are derived later from features/choices
        };

        // Compare relevant parts before updating
        const backgroundChanged = updatePayload.background !== data.background;
        const backstoryChanged = updatePayload.backstory !== data.backstory;
        const skillsChanged = JSON.stringify(updatePayload.skills) !== JSON.stringify(data.skills);
        const featureChoicesChanged = JSON.stringify(updatePayload.featureChoices) !== JSON.stringify(data.featureChoices);

        if (backgroundChanged || backstoryChanged || skillsChanged || featureChoicesChanged) {
            console.log("Step 5: Updating parent data with background info and choices");
            updateData(updatePayload);
        }

    }, [
        selectedBgName,
        formIsValid,
        isLoadingNames,
        isLoadingBgDetails,
        isLoadingBgFeatures,
        watchedPersonality,
        backgroundFeatures,
        setValidity,
        updateData,
        data.background,
        data.backstory,
        data.skills,
        data.featureChoices, // Include featureChoices in dependency
        getValues, // Include getValues if used for choices
    ]);


    const randomizeField = (fieldName: keyof Step5FormData, options?: string[]) => {
        if (options && options.length > 0) {
            const randomIndex = Math.floor(Math.random() * options.length);
            setValue(fieldName, options[randomIndex], { shouldValidate: true, shouldDirty: true });
        }
    };

    const isLoading = isLoadingNames || isLoadingBgDetails || isLoadingBgFeatures;

    // Extract features/proficiencies for display
    const mainBackgroundFeature = useMemo(() => backgroundFeatures?.find(f => f.source.includes('Background') && f.metadata?.effectType !== 'proficiencyGrant'), [backgroundFeatures]);
    const skillProficiencyFeatures = useMemo(() => backgroundFeatures?.filter(f => f.metadata?.effectType === 'proficiencyGrant' && f.metadata.type === 'skill') ?? [], [backgroundFeatures]);
    const toolProficiencyFeatures = useMemo(() => backgroundFeatures?.filter(f => f.metadata?.effectType === 'proficiencyGrant' && f.metadata.type === 'tool') ?? [], [backgroundFeatures]);
    const languageChoiceFeatures = useMemo(() => backgroundFeatures?.filter(f => f.metadata?.effectType === 'proficiencyGrant' && f.metadata.type === 'language' && f.metadata.choose) ?? [], [backgroundFeatures]);

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
                                    // Use field.value directly, handle potential null/undefined if needed
                                    value={field.value || ""} // Ensure value is a string
                                    onValueChange={(value) => field.onChange(value === 'null-value-placeholder' ? '' : value)} // Handle potential placeholder value if used
                                    disabled={isLoadingNames}
                                >
                                    <SelectTrigger id="background-select" className={isLoadingNames ? 'animate-pulse' : ''}>
                                        <SelectValue placeholder={isLoadingNames ? "Loading..." : "Choose a background..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                         {availableBackgroundNames.length === 0 && !isLoadingNames && (
                                             <SelectItem value="null-value-placeholder" disabled>No backgrounds found</SelectItem>
                                         )}
                                         {/* Add a placeholder item if needed */}
                                         {/* <SelectItem value="null-value-placeholder" disabled>Choose...</SelectItem> */}
                                         {availableBackgroundNames.map(bgName => (
                                            <SelectItem key={bgName} value={bgName}>{bgName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                       />
                        {errors.background && <p className="text-xs text-destructive mt-1">{errors.background.message}</p>}

                        {/* Display Fetched Feature Details */}
                        <div className="mt-4 space-y-2 text-sm">
                          {(isLoadingBgDetails || isLoadingBgFeatures) && selectedBgName && <Skeleton className="h-20 w-full" />}
                          {!isLoading && selectedBgName && !backgroundFeatures && (
                              <Alert variant='destructive' className='mt-4 text-xs'>
                                 <AlertCircle className="h-4 w-4" />
                                 <AlertTitle>Error</AlertTitle>
                                 <AlertDescription>Could not load features for this background.</AlertDescription>
                              </Alert>
                          )}
                           {!isLoading && backgroundFeatures && backgroundFeatures.length > 0 && (
                               <>
                                  <p className='font-medium text-foreground'>{selectedBgName}</p>
                                  {mainBackgroundFeature && (
                                      <div><strong>Feature: {mainBackgroundFeature.name}</strong> - {mainBackgroundFeature.description}</div>
                                  )}
                                   {skillProficiencyFeatures.map((f, i) => (
                                       <div key={`skill-${i}`}><strong>Skills:</strong> {f.metadata?.proficiencies?.join(', ')}</div>
                                   ))}
                                   {toolProficiencyFeatures.map((f, i) => (
                                       <div key={`tool-${i}`}><strong>Tools:</strong> {f.metadata?.proficiencies?.join(', ')}</div>
                                   ))}
                                   {/* TODO: Add UI for Language Choices */}
                                    {languageChoiceFeatures.map((f, i) => (
                                       <div key={`lang-${i}`}>
                                           <strong>Languages:</strong> Choose {f.metadata?.choose}.
                                           {/* Add dropdown/checkboxes here linked to form state */}
                                           <p className='text-xs text-muted-foreground'>(Language selection UI not implemented yet)</p>
                                       </div>
                                   ))}
                               </>
                           )}
                           {!isLoading && selectedBgName && backgroundFeatures?.length === 0 && (
                               <p className='text-xs text-muted-foreground italic'>No specific features defined for this background.</p>
                           )}
                        </div>
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
                                      <Dices className="h-3 w-3 mr-1" /> Suggest
                                  </Button>
                             </Label>
                             <Textarea id="personalityTrait" {...register('personalityTrait')} rows={2} placeholder="Describe a personality trait..." />
                         </div>
                          <div className="space-y-1">
                              <Label htmlFor="ideal" className="flex justify-between items-center">
                                  <span>Ideal</span>
                                   <Button type="button" variant="ghost" size="xs" onClick={() => randomizeField('ideal', currentBgData?.suggestedIdeals)} disabled={!selectedBgName || isLoadingBgDetails || !currentBgData?.suggestedIdeals}>
                                       <Dices className="h-3 w-3 mr-1" /> Suggest
                                   </Button>
                              </Label>
                              <Textarea id="ideal" {...register('ideal')} rows={1} placeholder="Describe an ideal..." />
                          </div>
                           <div className="space-y-1">
                               <Label htmlFor="bond" className="flex justify-between items-center">
                                   <span>Bond</span>
                                    <Button type="button" variant="ghost" size="xs" onClick={() => randomizeField('bond', currentBgData?.suggestedBonds)} disabled={!selectedBgName || isLoadingBgDetails || !currentBgData?.suggestedBonds}>
                                        <Dices className="h-3 w-3 mr-1" /> Suggest
                                    </Button>
                               </Label>
                               <Textarea id="bond" {...register('bond')} rows={1} placeholder="Describe a bond..." />
                           </div>
                            <div className="space-y-1">
                                <Label htmlFor="flaw" className="flex justify-between items-center">
                                    <span>Flaw</span>
                                     <Button type="button" variant="ghost" size="xs" onClick={() => randomizeField('flaw', currentBgData?.suggestedFlaws)} disabled={!selectedBgName || isLoadingBgDetails || !currentBgData?.suggestedFlaws}>
                                         <Dices className="h-3 w-3 mr-1" /> Suggest
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

    