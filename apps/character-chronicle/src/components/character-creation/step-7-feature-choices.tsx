'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { Feature, ChoiceGrantMetadata } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface Step7FeatureChoicesProps {
    data: PartialCharacterFormData;
    updateData: (newData: Partial<Pick<PartialCharacterFormData, 'featureChoices'>>) => void;
    setValidity: (isValid: boolean) => void;
}

export function Step7FeatureChoices({ data, updateData, setValidity }: Step7FeatureChoicesProps) {
    const [featureChoices, setFeatureChoices] = useState<Record<string, string | string[]>>(data.featureChoices || {});

    const featuresWithChoices = useMemo(() => {
        return (data.features || []).filter(
            (f): f is Feature & { metadata: ChoiceGrantMetadata } => f.metadata?.effectType === 'choiceGrant' && !!f.metadata.options && f.metadata.options.length > 0
        );
    }, [data.features]);

    // Update validity based on choices made vs choices required
    useEffect(() => {
        const allChoicesMade = featuresWithChoices.every(feature => {
            const choiceKey = feature.metadata.choiceKey;
            const requiredCount = feature.metadata.choose;
            const currentChoice = featureChoices[choiceKey];

            if (!currentChoice) return false; // Choice not made yet

            if (Array.isArray(currentChoice)) {
                return currentChoice.length === requiredCount;
            } else {
                return requiredCount === 1 && !!currentChoice; // Single choice must be selected
            }
        });
        setValidity(allChoicesMade);
    }, [featuresWithChoices, featureChoices, setValidity]);

    // Update parent data when local choices change
    useEffect(() => {
        updateData({ featureChoices });
    }, [featureChoices, updateData]);

    const handleChoiceChange = (choiceKey: string, option: string, isSelected: boolean, requiredCount: number) => {
        setFeatureChoices(prev => {
            const currentChoices = prev[choiceKey] || [];
            let newChoices: string | string[];

            if (requiredCount === 1) {
                // Single choice (Radio button / Select logic)
                newChoices = isSelected ? option : ''; // Allow unselecting if using checkbox for single choice, otherwise just set
            } else {
                // Multiple choices (Checkbox logic)
                const currentArray = Array.isArray(currentChoices) ? currentChoices : (currentChoices ? [currentChoices] : []);
                if (isSelected) {
                    if (currentArray.length < requiredCount) {
                        newChoices = [...currentArray, option];
                    } else {
                        // Prevent selecting more than allowed
                        alert(`You can only choose ${requiredCount} option(s).`);
                        return prev; // Revert
                    }
                } else {
                    newChoices = currentArray.filter(c => c !== option);
                }
            }

            return { ...prev, [choiceKey]: newChoices };
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Feature Choices</CardTitle>
                <CardDescription>Select options for features granted by your race, class, or background.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[450px] pr-4">
                    {featuresWithChoices.length === 0 ? (
                        <Alert variant="default">
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Choices Required</AlertTitle>
                            <AlertDescription>No features currently require you to make a choice.</AlertDescription>
                        </Alert>
                    ) : (
                        <div className="space-y-6">
                            {featuresWithChoices.map(feature => {
                                const choiceKey = feature.metadata.choiceKey;
                                const requiredCount = feature.metadata.choose;
                                const options = feature.metadata.options || [];
                                const currentChoice = featureChoices[choiceKey];

                                return (
                                    <div key={choiceKey} className="space-y-2 border p-4 rounded-md">
                                        <Label className="text-base font-semibold">{feature.name}</Label>
                                        <p className="text-sm text-muted-foreground">Choose {requiredCount}.</p>
                                        <div className="space-y-1 pt-2">
                                            {options.map(option => {
                                                 const isChecked = requiredCount === 1
                                                     ? currentChoice === option
                                                     : Array.isArray(currentChoice) && currentChoice.includes(option);
                                                 const isDisabled = requiredCount > 1 &&
                                                      !isChecked &&
                                                      Array.isArray(currentChoice) &&
                                                      currentChoice.length >= requiredCount;

                                                 return (
                                                     <div key={option} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`${choiceKey}-${option}`}
                                                            checked={isChecked}
                                                            onCheckedChange={(checked) => handleChoiceChange(choiceKey, option, Boolean(checked), requiredCount)}
                                                             disabled={isDisabled}
                                                        />
                                                        <Label htmlFor={`${choiceKey}-${option}`} className="text-sm font-normal cursor-pointer">
                                                             {option}
                                                         </Label>
                                                     </div>
                                                 );
                                             })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
