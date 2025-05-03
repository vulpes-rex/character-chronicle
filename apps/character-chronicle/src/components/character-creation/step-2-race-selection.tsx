'use client';

import React, { useState, useEffect } from 'react';
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { CharacterRace, Feature } from '@/lib/types'; // Use alias
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Use alias
import { ScrollArea } from '@/components/ui/scroll-area'; // Use alias
import Image from 'next/image'; // Correct import path
import { cn } from '@/lib/utils'; // Use alias
import { Skeleton } from '@/components/ui/skeleton'; // Use alias
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Use alias
import { AlertCircle } from 'lucide-react';
import { getRaceFeaturesAction } from '@/app/actions/feature-actions'; // Use Server Action

interface Step2RaceSelectionProps {
    data: PartialCharacterFormData;
    updateData: (newData: PartialCharacterFormData) => void;
    setValidity: (isValid: boolean) => void;
    availableRaces: CharacterRace[];
    isLoading: boolean;
}

export function Step2RaceSelection({ data, updateData, setValidity, availableRaces, isLoading }: Step2RaceSelectionProps) {
    const [selectedRaceName, setSelectedRaceName] = useState<string | undefined>(data.race);
    const [raceFeatures, setRaceFeatures] = useState<Feature[]>([]);
    const [loadingFeatures, setLoadingFeatures] = useState<boolean>(false);

    const selectedRaceDetails = availableRaces.find(r => r.name === selectedRaceName);

    // Fetch race features when selection changes
    useEffect(() => {
        const fetchFeatures = async () => {
            if (selectedRaceName) {
                setLoadingFeatures(true);
                const result = await getRaceFeaturesAction(selectedRaceName, data.campaignId); // Pass campaignId if needed
                if (result.success) {
                    setRaceFeatures(result.features);
                } else {
                    console.error("Failed to load race features:", result.error);
                    setRaceFeatures([]); // Clear features on error
                }
                setLoadingFeatures(false);
            } else {
                setRaceFeatures([]);
            }
        };
        fetchFeatures();
    }, [selectedRaceName, data.campaignId]); // Rerun if selected race or campaign context changes


    // Update main character data and validity
    useEffect(() => {
        updateData({
            race: selectedRaceName,
            // Only include race features here. Class features are added in step 3.
            // Features will be recalculated in the main wizard component based on all selections.
            // features: raceFeatures, // Let wizard handle combining features
        });
        setValidity(!!selectedRaceName); // Valid if a race is selected
    }, [selectedRaceName, updateData, setValidity]); // Removed raceFeatures dependency

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
                </div>
                <div className="md:col-span-1 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    if (!availableRaces || availableRaces.length === 0) {
       return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Races</AlertTitle>
                <AlertDescription>Could not load available character races. Please try again later or check the content packs for your campaign.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Race Gallery */}
            <div className="md:col-span-2">
                <h3 className="text-lg font-semibold mb-4">Select a Race</h3>
                <ScrollArea className="h-[500px] pr-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {availableRaces.map((race) => (
                            <Card
                                key={race.name}
                                className={cn(
                                    "cursor-pointer transition-all overflow-hidden",
                                    selectedRaceName === race.name ? "ring-2 ring-primary ring-offset-2" : "hover:shadow-md"
                                )}
                                onClick={() => setSelectedRaceName(race.name)}
                            >
                                <CardHeader className="p-0 relative aspect-video">
                                    {/* Placeholder Image */}
                                    <Image
                                        src={`https://picsum.photos/seed/${race.name}/300/200`}
                                        alt={race.name}
                                        fill
                                        style={{ objectFit: 'cover' }}
                                        className={cn(selectedRaceName !== race.name && "grayscale group-hover:grayscale-0 transition-all")}
                                        unoptimized // Use if picsum is not configured in next.config.js
                                        data-ai-hint={`${race.name} fantasy character`}
                                    />
                                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                     <CardTitle className="absolute bottom-2 left-3 text-lg font-bold text-white">
                                         {race.name}
                                     </CardTitle>
                                </CardHeader>
                                {/* <CardContent className="p-3">
                                    <p className="text-xs text-muted-foreground line-clamp-2">{race.description}</p>
                                </CardContent> */}
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Race Details */}
            <div className="md:col-span-1 space-y-4">
                <Card className="min-h-[516px]"> {/* Match height roughly */}
                    <CardHeader>
                        <CardTitle>{selectedRaceDetails?.name || "Select a Race"}</CardTitle>
                        <CardDescription>{selectedRaceDetails?.description || "Details will appear here."}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {selectedRaceDetails && (
                            <ScrollArea className="h-[400px] pr-2">
                                <div className="space-y-3 text-sm">
                                    <p><span className="font-semibold">Size:</span> {selectedRaceDetails.size || 'Medium'}</p>
                                    <p><span className="font-semibold">Speed:</span> {selectedRaceDetails.baseSpeed || 30} ft.</p>

                                    <h4 className="font-semibold text-base pt-2 border-t">Traits & Features</h4>
                                    {loadingFeatures ? (
                                        <Skeleton className="h-20 w-full" />
                                    ) : raceFeatures.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1 text-xs">
                                            {raceFeatures.map(feature => (
                                                <li key={feature.name}>
                                                    <span className="font-semibold">{feature.name}:</span> {feature.description}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">No specific traits listed (or failed to load).</p>
                                    )}
                                    {/* Add more details like ASI breakdown if needed, based on features */}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
