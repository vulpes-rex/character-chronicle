import React from 'react';
import type { Character } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge'; // Import Badge

interface CharacterFeaturesTraitsProps {
    features: Character['features'];
    featureChoices?: Character['featureChoices']; // Pass choices
}

export function CharacterFeaturesTraits({ features, featureChoices }: CharacterFeaturesTraitsProps) {

    if (!features || features.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Features & Traits</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No features or traits listed.</p>
                </CardContent>
            </Card>
        );
    }

     // Helper to get the selected choice for display
     const getChoiceDisplay = (featureKey: string | undefined): string | null => {
        if (!featureKey || !featureChoices || !featureChoices[featureKey]) return null;
        const choice = featureChoices[featureKey];
        return Array.isArray(choice) ? choice.join(', ') : choice;
     };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Features & Traits</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[300px] w-full pr-4"> {/* Adjust height as needed */}
                    <Accordion type="multiple" className="w-full">
                        {features.map((feature) => {
                             const choiceKey = feature.metadata?.effectType === 'choiceGrant' ? feature.metadata.choiceKey : undefined;
                             const selectedChoice = getChoiceDisplay(choiceKey);

                             return (
                                <AccordionItem key={feature.name} value={feature.name}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-2">
                                             <span>{feature.name}</span>
                                             <Badge variant="outline" className="text-xs ml-2">{feature.source}</Badge>
                                         </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-sm space-y-1">
                                        <p>{feature.description}</p>
                                         {selectedChoice && (
                                             <p className="text-xs italic text-muted-foreground">Selected: {selectedChoice}</p>
                                         )}
                                          {feature.maxUses != null && (
                                               <p className="text-xs text-muted-foreground">
                                                   Uses: {feature.currentUses ?? feature.maxUses}/{feature.maxUses} ({feature.usesResetOn || 'N/A'} rest)
                                               </p>
                                          )}
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
