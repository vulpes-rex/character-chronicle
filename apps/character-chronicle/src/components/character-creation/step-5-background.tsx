'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { BackgroundInfo, Feature, EquipmentItem } from '@/lib/types';
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, Dices } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { getBackgroundDetailsAction } from '@/app/actions/dnd-api-actions'; // Use server actions
import { getBackgroundFeaturesAction } from '@/app/actions/feature-actions'; // Use server actions
import { Checkbox } from '../ui/checkbox';

interface Step5BackgroundProps {
    data: PartialCharacterFormData;
    updateData: (newData: PartialCharacterFormData) => void;
    setValidity: (isValid: boolean) => void;
    availableBackgrounds: string[];
    isLoading: boolean;
     campaignId?: string; // Pass campaign ID for context
}

export function Step5Background({ data, updateData, setValidity, availableBackgrounds, isLoading, campaignId }: Step5BackgroundProps) {
    const [selectedBackgroundName, setSelectedBackgroundName] = useState<string | undefined>(data.background);
    const [backgroundDetails, setBackgroundDetails] = useState<BackgroundInfo | null>(null);
    const [backgroundFeatures, setBackgroundFeatures] = useState<Feature[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [personalityTraits, setPersonalityTraits] = useState<string>(""); // Using Textarea for freeform input
    const [featureChoices, setFeatureChoices] = useState<Record<string, string | string[]>>(data.featureChoices || {});

    // Fetch background details when selection changes
    useEffect(() => {
        const fetchDetails = async () => {
            if (selectedBackgroundName) {
                setLoadingDetails(true);
                try {
                    const result = await getBackgroundDetailsAction(selectedBackgroundName, campaignId);
                    if (result.success) {
                        setBackgroundDetails(result.details);
                        const featuresResult = await getBackgroundFeaturesAction(selectedBackgroundName, campaignId);
                        if (featuresResult.success) {
                            setBackgroundFeatures(featuresResult.features);
                        } else {
                            console.error("Failed to load background features:", featuresResult.error);
                            setBackgroundFeatures([]); // Clear features on error
                        }
                    } else {
                        console.error("Failed to load background details:", result.error);
                        setBackgroundDetails(null);
                        setBackgroundFeatures([]);
                    }
                } catch (error) {
                    console.error("Error fetching background info:", error);
                    setBackgroundDetails(null);
                    setBackgroundFeatures([]);
                } finally {
                    setLoadingDetails(false);
                }
            } else {
                setBackgroundDetails(null);
                setBackgroundFeatures([]);
            }
        };
        fetchDetails();
    }, [selectedBackgroundName, campaignId]);

    // Update main character data when background or choices change
     useEffect(() => {
         // Combine existing features with new background features
         // Remove old background features first before adding new ones
         const nonBackgroundFeatures = data.features?.filter(f => !f.source.includes('Background')) || [];
         const combinedFeatures = [...new Map([...nonBackgroundFeatures, ...backgroundFeatures].map(f => [f.name, f])).values()];

         updateData({
             background: selectedBackgroundName,
             // TODO: Extract granted proficiencies from backgroundFeatures and merge with existing ones
             // proficiencies: updatedProficiencies,
             features: combinedFeatures, // Update features
             featureChoices: featureChoices, // Update choices
         });
         setValidity(!!selectedBackgroundName); // Basic validation: background must be selected
     }, [selectedBackgroundName, backgroundFeatures, featureChoices, updateData, setValidity, data.features]);

     // Update local personality traits state if data changes externally
    useEffect(() => {
         // Assuming personality traits are stored somehow in character data, e.g., data.personalityTraits
         // setPersonalityTraits(data.personalityTraits || "");
         // For now, we'll just keep it simple as a textarea.
    }, [data]);


     const handleFeatureChoiceChange = (featureKey: string, choiceValue: string | string[]) => {
        setFeatureChoices(prev => ({
            ...prev,
            [featureKey]: choiceValue,
        }));
    };

    // Simple randomize function (replace with more complex logic if needed)
    const randomizeTraits = () => {
        const traits = backgroundDetails?.suggestedTraits || ["Trait 1", "Trait 2", "Trait 3", "Trait 4"];
        const ideals = backgroundDetails?.suggestedIdeals || ["Ideal 1", "Ideal 2"];
        const bonds = backgroundDetails?.suggestedBonds || ["Bond 1", "Bond 2"];
        const flaws = backgroundDetails?.suggestedFlaws || ["Flaw 1", "Flaw 2"];

        const randomTrait = traits[Math.floor(Math.random() * traits.length)];
        const randomIdeal = ideals[Math.floor(Math.random() * ideals.length)];
        const randomBond = bonds[Math.floor(Math.random() * bonds.length)];
        const randomFlaw = flaws[Math.floor(Math.random() * flaws.length)];

        setPersonalityTraits(
            `Personality Trait: ${randomTrait}\nIdeal: ${randomIdeal}\nBond: ${randomBond}\nFlaw: ${randomFlaw}`
        );
        // TODO: Update character data if personality traits are stored formally
        // updateData({ personalityTraits: randomizedString });
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
                        {isLoading ? (
                            <Skeleton className="h-10 w-full" />
                        ) : (
                            <Select
                                value={selectedBackgroundName}
                                onValueChange={setSelectedBackgroundName}
                                // disabled={isLoading} // Disable select only while backgrounds are loading
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select background..." />
                                </SelectTrigger>
                                <SelectContent>
                                     {availableBackgrounds.map((bg) => (
                                         <SelectItem key={bg} value={bg}>
                                             {bg}
                                         </SelectItem>
                                     ))}
                                </SelectContent>
                            </Select>
                        )}
                    </CardContent>
                </Card>

                <Card className="min-h-[300px]">
                    <CardHeader>
                        <CardTitle>Background Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingDetails ? (
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        ) : backgroundDetails ? (
                            <ScrollArea className="h-[250px] pr-4">
                                <p className="text-sm mb-2">{backgroundDetails.description}</p>
                                <h4 className="font-semibold mt-3 mb-1 text-sm">Feature: {backgroundDetails.feature?.name}</h4>
                                <p className="text-xs text-muted-foreground mb-2">{backgroundDetails.feature?.description}</p>

                                {backgroundFeatures.map(feature => (
                                     feature.metadata?.effectType === 'proficiencyGrant' && feature.metadata?.choose ? (
                                        <div key={feature.name} className="mt-3 space-y-1 border-t pt-2">
                                            <Label htmlFor={`choice-${feature.metadata.choiceKey}`} className="font-medium text-sm">Choose {feature.metadata.choose} {feature.metadata.type}(s):</Label>
                                            {feature.metadata.type === 'language' && feature.metadata.choose === 1 && feature.metadata.options ? (
                                                <Select
                                                    value={featureChoices[feature.metadata.choiceKey] as string || ""}
                                                    onValueChange={(value) => handleFeatureChoiceChange(feature.metadata.choiceKey, value)}
                                                >
                                                    <SelectTrigger id={`choice-${feature.metadata.choiceKey}`}>
                                                        <SelectValue placeholder={`Select a ${feature.metadata.type}...`} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                         {feature.metadata.options?.map(option => (
                                                             <SelectItem key={option} value={option}>{option}</SelectItem>
                                                         ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : feature.metadata.type === 'skill' && feature.metadata.choose && feature.metadata.options ? (
                                                 // Handle multiple skill choices with checkboxes
                                                 <div className="space-y-1">
                                                     {feature.metadata.options.map(option => (
                                                         <div key={option} className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id={`choice-${feature.metadata.choiceKey}-${option}`}
                                                                checked={(featureChoices[feature.metadata.choiceKey] as string[] || []).includes(option)}
                                                                onCheckedChange={(checked) => {
                                                                    const currentChoices = (featureChoices[feature.metadata.choiceKey] as string[] || []);
                                                                    let newChoices: string[];
                                                                    if (checked) {
                                                                        if (currentChoices.length < (feature.metadata?.choose || 0)) {
                                                                             newChoices = [...currentChoices, option];
                                                                        } else {
                                                                            // Prevent selecting more than allowed
                                                                            alert(`You can only choose ${feature.metadata.choose} skill(s).`);
                                                                            return; // Do not update state
                                                                        }
                                                                    } else {
                                                                        newChoices = currentChoices.filter(c => c !== option);
                                                                    }
                                                                    handleFeatureChoiceChange(feature.metadata.choiceKey, newChoices);
                                                                 }}
                                                             />
                                                             <Label htmlFor={`choice-${feature.metadata.choiceKey}-${option}`} className="text-sm font-normal">{option}</Label>
                                                         </div>
                                                     ))}
                                                 </div>
                                             ) : (
                                                <p className="text-xs text-muted-foreground italic">({feature.description})</p>
                                            )}
                                        </div>
                                    ) : null
                                ))}


                            </ScrollArea>
                        ) : (
                            <p className="text-sm text-muted-foreground">{selectedBackgroundName ? 'Loading details...' : 'Select a background to see details.'}</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Personality & Backstory */}
            <div className="md:col-span-2 space-y-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle>Personality Traits, Ideals, Bonds, Flaws</CardTitle>
                        <Button variant="outline" size="sm" onClick={randomizeTraits} disabled={!backgroundDetails}>
                            <Dices className="mr-2 h-4 w-4" /> Randomize
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="Describe your character's personality, or use the randomize button..."
                            value={personalityTraits}
                            onChange={(e) => setPersonalityTraits(e.target.value)}
                            rows={6}
                            className="text-sm"
                        />
                        {backgroundDetails && (
                             <p className="text-xs text-muted-foreground mt-2">Based on {backgroundDetails.name} suggestions (optional).</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Backstory</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="Write your character's backstory here..."
                            value={data.backstory || ""}
                            onChange={(e) => updateData({ backstory: e.target.value })}
                            rows={8}
                            className="text-sm"
                        />
                        {/* Optional: Integrate Backstory Generator */}
                        {/* <BackstoryGenerator characterData={data} updateBackstory={(bs) => updateData({ backstory: bs })} /> */}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
