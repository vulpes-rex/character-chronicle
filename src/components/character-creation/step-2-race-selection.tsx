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
import { getRaceFeatures } from '@/services/feature-service'; // Use feature service
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

    // Fetch feature details using the race name and combinedContent via feature service
    const { data: raceFeatures, isLoading: isLoadingTraits } = useQuery<Feature[], Error>({
        queryKey: ['raceFeatures', selectedRaceName, combinedContent], // Include combinedContent in key
        queryFn: () => selectedRaceName ? getRaceFeatures(selectedRaceName, combinedContent) : Promise.resolve([]), // Use getRaceFeatures from feature service
        enabled: !!selectedRaceName, // Enable only when race is selected
        staleTime: 5 * 60 * 1000, // Cache for 5 mins
    });


    // Update parent data and validity when selection changes or derived data changes
    useEffect(() => {
        // Validity depends only on selection
        setValidity(!!selectedRaceName);

        // Only update parent if a race is selected and it's different from current data
        if (selectedRaceName && selectedRaceName !== data.race) {
            const updatePayload: Partial<PartialCharacterFormData> = {
                race: selectedRaceName,
                 // Reset Tasha's choices if race changes? Maybe not, let Step 4 handle it.
                 // featureChoices: { ...data.featureChoices } // Preserve existing choices initially
            };
             console.log("Step 2: Updating parent data with selected race:", selectedRaceName);
            updateData(updatePayload);
        }
    }, [selectedRaceName, setValidity, updateData, data.race]);


    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Race Gallery */}
             <ScrollArea className="h-[500px] md:col-span-2 border rounded-lg p-4">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableRaces.length === 0 && <p className="text-muted-foreground col-span-full text-center">Loading races...</p>}
                    {availableRaces.map((race) => (
                        <Card
                            key={race.name}
                            className={cn(
                                "cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]",
                                selectedRaceName === race.name ? "ring-2 ring-primary shadow-lg scale-[1.02]" : "shadow-sm"
                            )}
                            onClick={() => setSelectedRaceName(race.name)}
                            tabIndex={0} // Make card focusable
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedRaceName(race.name); }}
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
                    {selectedRace && raceFeatures && raceFeatures.length > 0 && (
                         <ScrollArea className="h-[400px]">
                             <Accordion type="multiple" className="w-full">
                                {raceFeatures.map((feature, index) => (
                                     <AccordionItem value={`trait-${index}-${feature.name}`} key={`${index}-${feature.name}`}>
                                         <AccordionTrigger className="text-sm">{feature.name}</AccordionTrigger>
                                         <AccordionContent className="text-xs text-muted-foreground">
                                             {feature.description}
                                         </AccordionContent>
                                     </AccordionItem>
                                 ))}
                             </Accordion>
                         </ScrollArea>
                    )}
                     {selectedRace && !isLoadingTraits && (!raceFeatures || raceFeatures.length === 0) && (
                        <p className='text-sm text-muted-foreground italic'>No detailed features available for this race.</p>
                     )}
                     {!selectedRace && <p className="text-sm text-muted-foreground italic">Select a race to view its traits.</p>}
                </CardContent>
            </Card>
        </div>
    );
}