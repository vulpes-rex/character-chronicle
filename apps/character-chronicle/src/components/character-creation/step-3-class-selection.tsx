'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { CharacterClass as CharacterClassType, Feature, SourcePack } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, PlusCircle, Trash2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { getClassFeaturesAction, getFeatureDefinitionAction } from '@/app/actions/feature-actions'; // Use server actions

interface Step3ClassSelectionProps {
    data: PartialCharacterFormData;
    updateData: (newData: PartialCharacterFormData) => void;
    setValidity: (isValid: boolean) => void;
    availableClasses: CharacterClassType[];
    isLoading: boolean;
}

type SelectedClassLevel = {
    name: string;
    level: number;
};

export function Step3ClassSelection({ data, updateData, setValidity, availableClasses, isLoading }: Step3ClassSelectionProps) {
    const [selectedClasses, setSelectedClasses] = useState<SelectedClassLevel[]>(
        data.selectedClassLevels ? Object.entries(data.selectedClassLevels).map(([name, level]) => ({ name, level })) : []
    );
    const [classFeatures, setClassFeatures] = useState<Record<string, Feature[]>>({}); // Store features per class
    const [featureChoices, setFeatureChoices] = useState<Record<string, string | string[]>>(data.featureChoices || {});
    const [loadingFeatures, setLoadingFeatures] = useState<boolean>(false);
    const [errorFeatures, setErrorFeatures] = useState<string | null>(null);

    const totalLevel = useMemo(() => selectedClasses.reduce((sum, c) => sum + c.level, 0), [selectedClasses]);

    // Fetch features for selected classes whenever selection changes
    useEffect(() => {
        const fetchFeatures = async () => {
            if (selectedClasses.length === 0) {
                setClassFeatures({});
                setErrorFeatures(null);
                return;
            }
            setLoadingFeatures(true);
            setErrorFeatures(null);
            const featuresMap: Record<string, Feature[]> = {};
            let fetchError = false;

            try {
                const featurePromises = selectedClasses.map(async (cls) => {
                     // Use campaignId from data if available, otherwise undefined
                     const campaignId = data.campaignId;
                    const result = await getClassFeaturesAction(cls.name, cls.level, campaignId);
                    if (result.success) {
                        featuresMap[cls.name] = result.features;
                    } else {
                        console.error(`Failed to load features for ${cls.name}:`, result.error);
                        featuresMap[cls.name] = []; // Store empty array on error for this class
                        fetchError = true; // Mark that an error occurred
                    }
                });
                await Promise.all(featurePromises);
                setClassFeatures(featuresMap);
                if (fetchError) {
                    setErrorFeatures("Failed to load features for one or more classes. Data might be incomplete.");
                }
            } catch (error) {
                console.error("Error fetching class features:", error);
                setErrorFeatures("An error occurred while loading class features.");
            } finally {
                setLoadingFeatures(false);
            }
        };
        fetchFeatures();
    }, [selectedClasses, data.campaignId]);

    // Update main character data when selectedClasses or featureChoices change
    useEffect(() => {
        const combinedFeatures = Object.values(classFeatures).flat();
        const selectedClassLevels = selectedClasses.reduce((acc, curr) => {
             acc[curr.name] = curr.level;
             return acc;
        }, {} as Record<string, number>);

        updateData({
            class: selectedClasses[0]?.name, // Primary class is the first one added (simplification)
            level: totalLevel,
            // features: combinedFeatures, // Features are updated separately based on recalculation
            selectedClassLevels: selectedClassLevels,
            featureChoices: featureChoices,
            hitDice: { // Recalculate total hit dice
                ...data.hitDice,
                 total: totalLevel,
                 remaining: Math.min(data.hitDice?.remaining ?? totalLevel, totalLevel), // Ensure remaining doesn't exceed new total
                 // TODO: Determine hitDie based on primary class? Needs logic
                 // dieType: availableClasses.find(c => c.name === selectedClasses[0]?.name)?.hitDie || null,
             },
        });
        // Validate based on class selection
        setValidity(selectedClasses.length > 0 && totalLevel >= 1);

    }, [selectedClasses, classFeatures, featureChoices, totalLevel, updateData, setValidity, data.hitDice]);


    const handleAddClass = () => {
        // Add the first available class that isn't already selected
        const firstAvailable = availableClasses.find(cls => !selectedClasses.some(sc => sc.name === cls.name));
        if (firstAvailable) {
            setSelectedClasses([...selectedClasses, { name: firstAvailable.name, level: 1 }]);
        }
    };

    const handleClassChange = (index: number, newClassName: string) => {
        // Prevent selecting a class already chosen elsewhere
         if (selectedClasses.some((cls, i) => i !== index && cls.name === newClassName)) {
             alert("This class is already selected."); // Basic feedback
             return;
         }
        const updated = [...selectedClasses];
        updated[index] = { name: newClassName, level: 1 }; // Reset level on class change
        setSelectedClasses(updated);
    };

    const handleLevelChange = (index: number, newLevel: number) => {
        const level = Math.max(1, Math.min(20, newLevel || 1)); // Clamp level 1-20
        const updated = [...selectedClasses];
        updated[index].level = level;
        setSelectedClasses(updated);
    };

    const handleRemoveClass = (index: number) => {
        const updated = selectedClasses.filter((_, i) => i !== index);
        setSelectedClasses(updated);
        // Also remove features associated with the removed class (optional)
        const removedClassName = selectedClasses[index].name;
        setClassFeatures(prev => {
             const newFeatures = { ...prev };
             delete newFeatures[removedClassName];
             return newFeatures;
         });
         // Remove related feature choices
         setFeatureChoices(prev => {
             const newChoices = { ...prev };
             Object.keys(newChoices).forEach(key => {
                 if (key.startsWith(removedClassName)) { // Simple check if choice key relates to class
                     delete newChoices[key];
                 }
             });
             return newChoices;
         });
    };

     const handleFeatureChoiceChange = (featureKey: string, choiceValue: string | string[]) => {
        setFeatureChoices(prev => ({
            ...prev,
            [featureKey]: choiceValue,
        }));
    };

    // Get feature definition for choices - consider caching or pre-fetching if possible
    const getFeatureMetadata = (featureName: string): Feature['metadata'] | undefined => {
         // Search through all loaded class features
        for (const features of Object.values(classFeatures)) {
             const found = features.find(f => f.name === featureName);
             if (found) return found.metadata;
         }
        // Also check base features if they are available (e.g., passed via props or context)
        // const baseFeature = data.features?.find(f => f.name === featureName);
        // if (baseFeature) return baseFeature.metadata;
         return undefined;
     };


    if (isLoading) {
        return <Skeleton className="h-64 w-full" />;
    }
     if (!availableClasses || availableClasses.length === 0) {
        return (
             <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Error Loading Classes</AlertTitle>
                 <AlertDescription>Could not load available character classes. Please try again later.</AlertDescription>
             </Alert>
         );
    }


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Class & Level</CardTitle>
                    <CardDescription>Select your character's class(es) and levels. Your total level is {totalLevel}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {selectedClasses.map((selectedClass, index) => (
                        <div key={index} className="flex items-end space-x-2 p-3 border rounded">
                            <div className="flex-1">
                                <Label htmlFor={`class-${index}`}>Class {index + 1}</Label>
                                <Select
                                    value={selectedClass.name}
                                    onValueChange={(value) => handleClassChange(index, value)}
                                >
                                    <SelectTrigger id={`class-${index}`}>
                                        <SelectValue placeholder="Select class..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableClasses.map((cls) => (
                                            <SelectItem key={cls.name} value={cls.name} disabled={selectedClasses.some((sc, i) => i !== index && sc.name === cls.name)}>
                                                {cls.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-20">
                                <Label htmlFor={`level-${index}`}>Level</Label>
                                <Input
                                    id={`level-${index}`}
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={selectedClass.level}
                                    onChange={(e) => handleLevelChange(index, parseInt(e.target.value))}
                                    className="text-center"
                                />
                            </div>
                            {selectedClasses.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveClass(index)}
                                    className="text-destructive hover:text-destructive-hover"
                                    title={`Remove ${selectedClass.name}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                    <Button variant="outline" onClick={handleAddClass} disabled={selectedClasses.length >= availableClasses.length}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Class (Multiclass)
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Class Features</CardTitle>
                    <CardDescription>Features gained from your selected class(es) and levels.</CardDescription>
                     {errorFeatures && (
                        <Alert variant="destructive" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Feature Loading Error</AlertTitle>
                            <AlertDescription>{errorFeatures}</AlertDescription>
                        </Alert>
                    )}
                </CardHeader>
                <CardContent>
                    {loadingFeatures ? (
                        <Skeleton className="h-40 w-full" />
                    ) : selectedClasses.length === 0 ? (
                         <p className="text-muted-foreground">Select a class to see its features.</p>
                     ) : (
                         <ScrollArea className="h-[400px] w-full pr-4">
                             <Accordion type="multiple" className="w-full">
                                {selectedClasses.map((selectedClass) => (
                                    <div key={selectedClass.name} className="mb-4 border-b pb-4">
                                         <h3 className="text-lg font-semibold mb-2">{selectedClass.name} Features (Level {selectedClass.level})</h3>
                                        {(classFeatures[selectedClass.name] || []).length === 0 && !loadingFeatures && (
                                            <p className="text-sm text-muted-foreground">No features listed for {selectedClass.name} at level {selectedClass.level} (or failed to load).</p>
                                        )}
                                        {(classFeatures[selectedClass.name] || []).map((feature) => (
                                            <AccordionItem key={feature.name} value={feature.name}>
                                                <AccordionTrigger>{feature.name}</AccordionTrigger>
                                                <AccordionContent className="space-y-2">
                                                    <p className="text-sm">{feature.description}</p>
                                                     {/* Render choices if the feature requires them */}
                                                    {feature.metadata?.effectType === 'choiceGrant' && (
                                                        <div className="mt-2 space-y-1 p-2 border rounded bg-muted/50">
                                                            <Label htmlFor={`choice-${feature.metadata.choiceKey}`} className="font-medium">Choose {feature.metadata.choose}:</Label>
                                                            <Select
                                                                value={featureChoices[feature.metadata.choiceKey] as string || ''} // Assuming single choice for now
                                                                onValueChange={(value) => handleFeatureChoiceChange(feature.metadata.choiceKey, value)}
                                                                 // Use a unique ID combining class and feature key
                                                                 // id={`choice-${selectedClass.name}-${feature.metadata.choiceKey}`}
                                                            >
                                                                <SelectTrigger id={`choice-${feature.metadata.choiceKey}`}>
                                                                    <SelectValue placeholder="Select an option..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {feature.metadata.options?.map(option => (
                                                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            {/* TODO: Handle multi-choice selection if needed (e.g., checkboxes) */}
                                                        </div>
                                                    )}
                                                    {/* You can add more details here, like source, action type, etc. */}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </div>
                                ))}
                            </Accordion>
                         </ScrollArea>
                     )}
                </CardContent>
            </Card>
        </div>
    );
}
