
'use client';

import { useEffect, useState, useMemo } from 'react'; // Keep useMemo for potential future optimization if needed elsewhere
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { CharacterRace, Feature, SourcePack } from '@/lib/types';
import { getRaceTraitsDetails } from '@/services/dnd-api';
import { useQuery } from '@tanstack/react-query';


interface Step2Props {
    data: PartialCharacterFormData;
    updateData: (data: Partial<PartialCharacterFormData>) => void;
    setValidity: (isValid: boolean) => void;
    availableRaces: CharacterRace[];
    combinedContent?: SourcePack['content']; // Add combinedContent prop
}

export function Step2RaceSelection({ data, updateData, setValidity, availableRaces, combinedContent }: Step2Props) {
    const [selectedRaceName, setSelectedRaceName] = useState<string | null>(data.race || null);
    const selectedRace = availableRaces.find(r => r.name === selectedRaceName);

    // Fetch trait details using the race's trait keys and the combinedContent
    const { data: traitDetails, isLoading: isLoadingTraits } = useQuery<Feature[], Error>({
        queryKey: ['raceTraits', selectedRace?.name, combinedContent], // Include combinedContent in key
        queryFn: () => selectedRace?.traits ? getRaceTraitsDetails(selectedRace.traits, combinedContent) : Promise.resolve([]),
        enabled: !!selectedRace && !!combinedContent, // Enable only when race and content are available
        staleTime: Infinity, // Trait details are static for a given content set
    });


    // Update parent data and validity when selection changes or derived data changes
    useEffect(() => {
        // Validity depends only on selection
        setValidity(!!selectedRaceName);

        // Calculate the update data inside the effect based on current state
        const baseFeatures = data.tempFeatures?.filter(f => f.source !== 'Race') ?? [];
        const baseProficiencies = {
            armor: data.tempProficiencies?.armor?.filter(p => !p.endsWith('(Race)')) ?? [],
            weapons: data.tempProficiencies?.weapons?.filter(p => !p.endsWith('(Race)')) ?? [],
            tools: data.tempProficiencies?.tools?.filter(p => !p.endsWith('(Race)')) ?? [],
            savingThrows: data.tempProficiencies?.savingThrows ?? [],
        };

        let finalFeatures = [...baseFeatures];
        let finalProficiencies = { ...baseProficiencies };

        if (selectedRaceName && traitDetails) {
             // Traits are now full Feature objects, directly add them with source marking
             finalFeatures = [...baseFeatures, ...traitDetails.map(t => ({ ...t, source: 'Race' }))];

            // Extract proficiencies granted by race traits with metadata
             traitDetails.forEach(trait => {
                if (trait.metadata?.effectType === 'proficiencyGrant') {
                    const marker = '(Race)';
                     switch (trait.metadata.type) {
                         case 'armor':
                             finalProficiencies.armor.push(...trait.metadata.proficiencies.map(p => `${p} ${marker}`));
                             break;
                         case 'weapon':
                             finalProficiencies.weapons.push(...trait.metadata.proficiencies.map(p => `${p} ${marker}`));
                             break;
                         case 'tool':
                             finalProficiencies.tools.push(...trait.metadata.proficiencies.map(p => `${p} ${marker}`));
                             break;
                         // Note: Race traits typically don't grant saving throw or skill proficiencies directly,
                         // those usually come from class/background. Handle if needed.
                     }
                }
            });
             // Ensure uniqueness
            finalProficiencies.armor = [...new Set(finalProficiencies.armor)];
            finalProficiencies.weapons = [...new Set(finalProficiencies.weapons)];
            finalProficiencies.tools = [...new Set(finalProficiencies.tools)];
        }

        // Create the update object
        const updatePayload: Partial<PartialCharacterFormData> = {
            race: selectedRaceName || '',
            tempFeatures: finalFeatures,
            tempProficiencies: finalProficiencies,
        };

        // Compare relevant parts before updating
        const raceChanged = updatePayload.race !== data.race;
        const featuresChanged = JSON.stringify(updatePayload.tempFeatures) !== JSON.stringify(data.tempFeatures);
        const proficienciesChanged = JSON.stringify(updatePayload.tempProficiencies) !== JSON.stringify(data.tempProficiencies);

        if (raceChanged || featuresChanged || proficienciesChanged) {
             console.log("Step 2: Updating parent data");
            updateData(updatePayload);
        }

    }, [
        selectedRaceName,
        traitDetails,
        setValidity,
        updateData,
        data.race,
        data.tempFeatures,
        data.tempProficiencies
    ]);


    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Race Gallery */}
             <ScrollArea className="h-[500px] md:col-span-2 border rounded-lg p-4">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableRaces.map((race) => (
                        <Card
                            key={race.name}
                            className={cn(
                                "cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]",
                                selectedRaceName === race.name ? "ring-2 ring-primary shadow-lg scale-[1.02]" : "shadow-sm"
                            )}
                            onClick={() => setSelectedRaceName(race.name)}
                        >
                            <CardHeader className="p-0 relative aspect-square overflow-hidden rounded-t-lg">
                                <Image
                                    src={`https://picsum.photos/seed/${race.name}/300/300`}
                                    alt={race.name}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                    priority={false}
                                    data-ai-hint={`${race.name.toLowerCase()} fantasy race`}
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                    <CardTitle className="text-sm font-semibold text-primary-foreground">{race.name}</CardTitle>
                                </div>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </ScrollArea>

            {/* Selected Race Details */}
            <Card className="md:col-span-1">
                <CardHeader>
                    <CardTitle>{selectedRace ? selectedRace.name : "Select a Race"}</CardTitle>
                     <CardDescription>
                        {selectedRace ? selectedRace.description : "Choose a race from the gallery to see details."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     {isLoadingTraits && selectedRace && (
                         <div className="space-y-2">
                             <Skeleton className="h-4 w-3/4" />
                             <Skeleton className="h-4 w-1/2" />
                             <Skeleton className="h-4 w-5/6" />
                         </div>
                     )}
                    {selectedRace && traitDetails && traitDetails.length > 0 && (
                         <ScrollArea className="h-[400px]">
                             <Accordion type="multiple" className="w-full">
                                {traitDetails.map((trait, index) => (
                                     <AccordionItem value={`trait-${index}`} key={trait.name}>
                                         <AccordionTrigger className="text-sm">{trait.name}</AccordionTrigger>
                                         <AccordionContent className="text-xs text-muted-foreground">
                                             {trait.description}
                                         </AccordionContent>
                                     </AccordionItem>
                                 ))}
                             </Accordion>
                         </ScrollArea>
                    )}
                     {selectedRace && !isLoadingTraits && (!traitDetails || traitDetails.length === 0) && (
                        <p className='text-sm text-muted-foreground italic'>No detailed traits available.</p>
                     )}
                </CardContent>
            </Card>
        </div>
    );
}

