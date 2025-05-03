
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { Feature, ProficiencyGrantMetadata, ChoiceGrantMetadata, SourcePack } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface Step7Props {
    data: PartialCharacterFormData;
    updateData: (data: Partial<PartialCharacterFormData>) => void;
    setValidity: (isValid: boolean) => void;
    allFeatures: Feature[]; // All features accumulated so far
    isLoadingFeatures: boolean;
    combinedContent?: SourcePack['content']; // Needed for fetching language options etc.
}

export function Step7Features({
    data,
    updateData,
    setValidity,
    allFeatures,
    isLoadingFeatures,
    combinedContent
}: Step7Props) {
    const [featureChoices, setFeatureChoices] = useState<Record<string, string | string[]>>(data.featureChoices || {});

    // Identify features that require choices
    const choiceFeatures = allFeatures.filter(
        f => f.metadata?.effectType === 'choiceGrant' ||
             (f.metadata?.effectType === 'proficiencyGrant' && f.metadata.choose && f.metadata.options && f.metadata.options.length > 0)
    );

    // Validate if all required choices have been made
    const areAllChoicesMade = choiceFeatures.every(feature => {
        const metadata = feature.metadata as ChoiceGrantMetadata | ProficiencyGrantMetadata;
        const choiceKey = (metadata as ChoiceGrantMetadata).choiceKey || feature.name; // Use choiceKey or feature name
        const choice = featureChoices[choiceKey];
        const requiredCount = metadata.choose || 0;

        if (requiredCount === 0) return true; // No choice needed

        if (Array.isArray(choice)) {
            return choice.length === requiredCount;
        } else {
            return !!choice && requiredCount === 1; // Ensure single choice is made if requiredCount is 1
        }
    });

    // Update parent data and validity when choices change
    useEffect(() => {
        setValidity(areAllChoicesMade);
        if (JSON.stringify(featureChoices) !== JSON.stringify(data.featureChoices)) {
            console.log("Step 7: Updating parent data with feature choices");
            updateData({ featureChoices: featureChoices });
        }
    }, [featureChoices, areAllChoicesMade, setValidity, updateData, data.featureChoices]);

    // Handle changes for single-choice dropdowns
    const handleSingleChoiceChange = (choiceKey: string, value: string) => {
        setFeatureChoices(prev => ({ ...prev, [choiceKey]: value }));
    };

    // Handle changes for multi-choice checkboxes
    const handleMultiChoiceChange = (choiceKey: string, option: string, isChecked: boolean, maxChoices: number) => {
        setFeatureChoices(prev => {
            const currentChoices = (prev[choiceKey] || []) as string[];
            let newChoices;
            if (isChecked) {
                // Add choice if not already present and under limit
                if (!currentChoices.includes(option) && currentChoices.length < maxChoices) {
                    newChoices = [...currentChoices, option];
                } else {
                    newChoices = currentChoices; // No change if limit reached or already present
                }
            } else {
                // Remove choice
                newChoices = currentChoices.filter(c => c !== option);
            }
            return { ...prev, [choiceKey]: newChoices };
        });
    };

    if (isLoadingFeatures) {
        return <Skeleton className="h-64 w-full" />;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Feature Choices</CardTitle>
                <CardDescription>
                    Select options for features granted by your race, class, or background.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {choiceFeatures.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No features require choices at this time.</p>
                ) : (
                    <ScrollArea className="h-[400px]">
                        <Accordion type="multiple" className="w-full space-y-4">
                            {choiceFeatures.map((feature, index) => {
                                const metadata = feature.metadata as ChoiceGrantMetadata | ProficiencyGrantMetadata;
                                const choiceKey = (metadata as ChoiceGrantMetadata).choiceKey || feature.name;
                                const requiredCount = metadata.choose || 0;
                                const options = metadata.options || [];
                                const currentChoice = featureChoices[choiceKey];

                                // Determine if this choice is complete
                                const isChoiceComplete = Array.isArray(currentChoice)
                                    ? currentChoice.length === requiredCount
                                    : (!!currentChoice && requiredCount === 1) || requiredCount === 0;

                                return (
                                    <AccordionItem value={`feature-choice-${index}`} key={`choice-${index}-${feature.name}`} className="border rounded-md px-4 bg-secondary/30">
                                        <AccordionTrigger className="text-base hover:no-underline">
                                             <div className='flex justify-between w-full pr-2 items-center'>
                                                <span>{feature.name} (Choose {requiredCount})</span>
                                                 {!isChoiceComplete && <AlertCircle className="h-4 w-4 text-destructive inline-block ml-2" />}
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2 pb-4 space-y-3">
                                            <p className="text-xs text-muted-foreground">{feature.description}</p>
                                            {options.length === 0 && <p className='text-xs text-destructive'>Error: No options defined for this feature choice.</p>}
                                            {options.length > 0 && (
                                                <>
                                                    {/* Single Choice (Dropdown) */}
                                                    {requiredCount === 1 && !Array.isArray(currentChoice) && (
                                                        <div className="space-y-1">
                                                            <Label htmlFor={`choice-${choiceKey}`} className="text-xs">Select One:</Label>
                                                            <Select
                                                                value={currentChoice || ""}
                                                                onValueChange={(value) => handleSingleChoiceChange(choiceKey, value)}
                                                            >
                                                                <SelectTrigger id={`choice-${choiceKey}`}>
                                                                    <SelectValue placeholder="Select an option..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {options.map(option => (
                                                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                                    {/* Multiple Choices (Checkboxes) */}
                                                    {requiredCount > 1 && (
                                                        <div className="space-y-2">
                                                            <Label className="text-xs">Select {requiredCount}:</Label>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {options.map(option => {
                                                                    const currentChoices = (currentChoice || []) as string[];
                                                                    const isChecked = currentChoices.includes(option);
                                                                    const isDisabled = !isChecked && currentChoices.length >= requiredCount;
                                                                    return (
                                                                        <div key={option} className="flex items-center space-x-2">
                                                                            <Checkbox
                                                                                id={`choice-${choiceKey}-${option}`}
                                                                                checked={isChecked}
                                                                                onCheckedChange={(checked) => handleMultiChoiceChange(choiceKey, option, !!checked, requiredCount)}
                                                                                disabled={isDisabled}
                                                                            />
                                                                            <Label htmlFor={`choice-${choiceKey}-${option}`} className={`text-sm font-normal ${isDisabled ? 'text-muted-foreground cursor-not-allowed' : 'cursor-pointer'}`}>
                                                                                {option}
                                                                            </Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {Array.isArray(currentChoice) && currentChoice.length !== requiredCount && (
                                                                 <Alert variant='destructive' className='p-2 text-xs mt-2'>
                                                                     <AlertCircle className="h-3 w-3"/>
                                                                     <AlertDescription>Please select exactly {requiredCount} options.</AlertDescription>
                                                                 </Alert>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    </ScrollArea>
                )}
                 {!areAllChoicesMade && choiceFeatures.length > 0 && (
                    <Alert variant="destructive" className='mt-4'>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>Please make all required feature choices.</AlertDescription>
                    </Alert>
                 )}
            </CardContent>
        </Card>
    );
}
