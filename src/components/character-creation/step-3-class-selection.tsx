
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react'; // Keep useMemo for potential future optimizations
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, Trash2 } from 'lucide-react';
import { useQueries } from '@tanstack/react-query'; // Use useQueries for multiple feature fetches
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { CharacterClass, Feature } from '@/lib/types';
import { getCumulativeClassFeatures } from '@/services/dnd-api'; // Keep using this


interface Step3Props {
    data: PartialCharacterFormData;
    // Update prop type to match changes in Step2
    updateData: (data: Partial<PartialCharacterFormData>) => void;
    setValidity: (isValid: boolean) => void;
    availableClasses: CharacterClass[];
}

export function Step3ClassSelection({ data, updateData, setValidity, availableClasses }: Step3Props) {
    const [selectedClasses, setSelectedClasses] = useState<{ [key: string]: number }>(data.selectedClasses || {});
    const [featureError, setFeatureError] = useState<string | null>(null);

    const totalLevel = Object.values(selectedClasses).reduce((sum, lvl) => sum + lvl, 0);
    const maxLevelReached = totalLevel >= 20;

    // --- Fetch Features Concurrently ---
     const featureQueries = useMemo(() => Object.entries(selectedClasses)
        .filter(([_, level]) => level > 0)
        .map(([className, level]) => ({
            queryKey: ['classFeatures', className, level],
            queryFn: () => getCumulativeClassFeatures(className, level),
            enabled: level > 0,
            staleTime: Infinity, // Features are generally static
        })), [selectedClasses]);

    const featureResults = useQueries({ queries: featureQueries });

    const isLoadingFeatures = featureResults.some(result => result.isLoading);
    const allClassFeatures = useMemo(() => {
        const featuresByClass: { [key: string]: Feature[] } = {};
        featureResults.forEach((result, index) => {
            if (result.isSuccess && result.data) {
                const queryKey = featureQueries[index].queryKey;
                const className = queryKey[1] as string; // Extract class name from query key
                featuresByClass[className] = result.data;
            } else if (result.isError) {
                 // Handle individual query errors if necessary
                 console.error(`Error fetching features for ${featureQueries[index].queryKey[1]}:`, result.error);
                 setFeatureError(`Failed to load features for ${featureQueries[index].queryKey[1]}.`);
            }
        });
        return featuresByClass;
    }, [featureResults, featureQueries]);


    // Update overall validity and parent state
    useEffect(() => {
        // Update Validity
        setValidity(totalLevel > 0 && totalLevel <= 20 && !isLoadingFeatures && !featureError);

        // Calculate Derived Update Data inside the effect
        const allFeatures: Feature[] = [...(data.tempFeatures?.filter(f => f.source !== 'Class') ?? [])];
        const baseProficiencies = {
            armor: [...(data.tempProficiencies?.armor?.filter(p => !p.endsWith('(Class)')) ?? [])],
            weapons: [...(data.tempProficiencies?.weapons?.filter(p => !p.endsWith('(Class)')) ?? [])],
            tools: [...(data.tempProficiencies?.tools?.filter(p => !p.endsWith('(Class)')) ?? [])],
            savingThrows: [], // Start fresh, only add first class's throws
        };

        let isFirstClass = true;
        Object.entries(selectedClasses).forEach(([className, level]) => {
            const classData = availableClasses.find(c => c.name === className);
            const features = allClassFeatures[className]; // Use memoized features

            if (!classData || level <= 0) return;

            if (features) {
                allFeatures.push(...features.map(f => ({ ...f, source: 'Class' })));
            }

            // Add class proficiencies (handle potential duplicates)
            baseProficiencies.armor = [...new Set([...baseProficiencies.armor, ...classData.proficiencies.armor.map(p => `${p} (Class)`)])];
            baseProficiencies.weapons = [...new Set([...baseProficiencies.weapons, ...classData.proficiencies.weapons.map(p => `${p} (Class)`)])];
            baseProficiencies.tools = [...new Set([...baseProficiencies.tools, ...(classData.proficiencies.tools ?? []).map(p => `${p} (Class)`)])];

            if (isFirstClass) {
                baseProficiencies.savingThrows = [...new Set([...classData.proficiencies.savingThrows])];
                isFirstClass = false;
            }
        });

        const updatePayload: Partial<PartialCharacterFormData> = {
            class: Object.keys(selectedClasses)[0] || '',
            level: totalLevel || 1,
            selectedClasses: selectedClasses,
            tempFeatures: allFeatures,
            tempProficiencies: baseProficiencies,
        };

        // Compare specific parts of the state to decide if an update is needed
        const selectedClassesChanged = JSON.stringify(updatePayload.selectedClasses) !== JSON.stringify(data.selectedClasses);
        const featuresChanged = JSON.stringify(updatePayload.tempFeatures) !== JSON.stringify(data.tempFeatures);
        const proficienciesChanged = JSON.stringify(updatePayload.tempProficiencies) !== JSON.stringify(data.tempProficiencies);

        if (selectedClassesChanged || featuresChanged || proficienciesChanged) {
             console.log("Step 3: Updating parent data"); // Debug log
            updateData(updatePayload);
        }

    // Depend on the states that directly influence the calculation and validity.
    // Also depend on the stable callback functions.
    // Include relevant parts of `data` used in comparison.
    }, [
        selectedClasses,
        totalLevel,
        isLoadingFeatures,
        featureError,
        setValidity,
        updateData,
        availableClasses,
        allClassFeatures,
        data.selectedClasses,
        data.tempFeatures,
        data.tempProficiencies
    ]);


    const handleAddClass = () => {
        // Find the first available class not already selected
        const firstAvailable = availableClasses.find(c => !selectedClasses[c.name]);
        if (firstAvailable && !maxLevelReached) {
            setSelectedClasses(prev => ({ ...prev, [firstAvailable.name]: 1 }));
        }
    };

    const handleRemoveClass = (className: string) => {
        setSelectedClasses(prev => {
            const newState = { ...prev };
            delete newState[className];
            // If removing the last class, ensure state reflects it properly
            if (Object.keys(newState).length === 0) {
                // Optionally reset related fields in parent via updateData if needed
            }
            return newState;
        });
    };

    const handleClassChange = (oldName: string, newName: string) => {
        if (newName === oldName || selectedClasses[newName]) return; // No change or already selected
        setSelectedClasses(prev => {
            const newState = { ...prev };
            const level = newState[oldName];
            delete newState[oldName];
            newState[newName] = level;
            return newState;
        });
    };

    const handleLevelChange = (className: string, newLevel: number) => {
         const currentLevel = selectedClasses[className];
         const levelDifference = newLevel - currentLevel;
         const newTotalLevel = totalLevel + levelDifference;

         if (newTotalLevel > 20) {
             // Adjust newLevel so total doesn't exceed 20
             newLevel = newLevel - (newTotalLevel - 20);
         }
         if (newLevel < 1) newLevel = 1; // Minimum level 1

        setSelectedClasses(prev => ({ ...prev, [className]: newLevel }));
    };


    // Pre-calculate derived proficiencies for display to avoid doing it inside the render function directly
    const derivedProficienciesForDisplay = useMemo(() => {
        const profs = { armor: [], weapons: [], tools: [], savingThrows: [] };
        let isFirst = true;
        Object.entries(selectedClasses).forEach(([className, level]) => {
            const classData = availableClasses.find(c => c.name === className);
            if (!classData || level <= 0) return;
             profs.armor = [...new Set([...profs.armor, ...classData.proficiencies.armor])];
             profs.weapons = [...new Set([...profs.weapons, ...classData.proficiencies.weapons])];
             profs.tools = [...new Set([...profs.tools, ...(classData.proficiencies.tools ?? [])])];
             if (isFirst) {
                 profs.savingThrows = [...new Set([...classData.proficiencies.savingThrows])];
                 isFirst = false;
             }
        });
        return profs;
    }, [selectedClasses, availableClasses]);


    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Class Selection Controls */}
            <div className="md:col-span-1 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Select Classes</CardTitle>
                        <CardDescription>Choose your class(es) and levels. Max total level is 20.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Object.keys(selectedClasses).length === 0 && (
                            <p className='text-sm text-muted-foreground text-center py-4'>No classes selected yet.</p>
                        )}
                        {Object.entries(selectedClasses).map(([className, level]) => (
                            <div key={className} className="flex items-center gap-2 border p-2 rounded-md">
                                <Select
                                    value={className}
                                    onValueChange={(newClassName) => handleClassChange(className, newClassName)}
                                    disabled={isLoadingFeatures}
                                >
                                    <SelectTrigger className="flex-grow">
                                        <SelectValue placeholder="Select Class..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableClasses.map(c => (
                                            <SelectItem
                                                key={c.name} // Use stable key
                                                value={c.name}
                                                disabled={selectedClasses[c.name] !== undefined && c.name !== className} // Disable if already selected elsewhere
                                            >
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                     value={String(level)}
                                     onValueChange={(value) => handleLevelChange(className, parseInt(value))}
                                     disabled={isLoadingFeatures}
                                >
                                     <SelectTrigger className="w-20 shrink-0">
                                        <SelectValue/>
                                     </SelectTrigger>
                                      <SelectContent>
                                        {Array.from({ length: 20 }, (_, i) => i + 1).map(lvl => {
                                             const potentialTotal = totalLevel - level + lvl;
                                             const isDisabled = potentialTotal > 20;
                                             return (
                                                <SelectItem key={lvl} value={String(lvl)} disabled={isDisabled}> {/* Use stable key */}
                                                    Lvl {lvl}
                                                </SelectItem>
                                             );
                                        })}
                                      </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive h-8 w-8"
                                    onClick={() => handleRemoveClass(className)}
                                    disabled={isLoadingFeatures}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                         {totalLevel < 20 && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddClass}
                                disabled={isLoadingFeatures || availableClasses.length <= Object.keys(selectedClasses).length || maxLevelReached}
                                className='w-full mt-4'
                            >
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Another Class
                            </Button>
                        )}
                        {totalLevel > 20 && (
                            <Alert variant="destructive" className="mt-2">
                               <AlertCircle className="h-4 w-4" />
                               <AlertDescription>Total level cannot exceed 20.</AlertDescription>
                           </Alert>
                        )}
                         {featureError && (
                             <Alert variant="destructive" className="mt-2">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error Loading Features</AlertTitle>
                                <AlertDescription>{featureError}</AlertDescription>
                            </Alert>
                         )}
                    </CardContent>
                </Card>
                 {/* Display calculated proficiencies */}
                 <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className='text-base'>Proficiencies Gained</CardTitle>
                    </CardHeader>
                     {/* Use derivedProficienciesForDisplay here */}
                     <CardContent className='text-xs space-y-1'>
                         <p><strong>Saving Throws:</strong> {derivedProficienciesForDisplay.savingThrows?.join(', ') || 'None'}</p>
                         <p><strong>Armor:</strong> {derivedProficienciesForDisplay.armor?.join(', ') || 'None'}</p>
                         <p><strong>Weapons:</strong> {derivedProficienciesForDisplay.weapons?.join(', ') || 'None'}</p>
                         <p><strong>Tools:</strong> {derivedProficienciesForDisplay.tools?.join(', ') || 'None'}</p>
                     </CardContent>
                 </Card>
            </div>

            {/* Feature Display Area */}
            <div className="md:col-span-2">
                <Card className="h-[600px] flex flex-col"> {/* Fixed height */}
                    <CardHeader>
                        <CardTitle>Class Features (Up to Level {totalLevel})</CardTitle>
                        <CardDescription>Features gained from selected classes and levels.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-hidden"> {/* Make content grow and hide overflow */}
                        <ScrollArea className="h-full pr-4"> {/* ScrollArea needs defined height from parent */}
                            {isLoadingFeatures && <Skeleton className="h-full w-full" />}
                            {!isLoadingFeatures && Object.keys(allClassFeatures).length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-10">Select a class to see its features.</p>
                            )}
                            {!isLoadingFeatures && Object.keys(allClassFeatures).length > 0 && (
                                <Accordion type="multiple" className="w-full">
                                    {Object.entries(allClassFeatures).map(([className, features]) => (
                                        <AccordionItem value={className} key={className}> {/* Use stable key */}
                                            <AccordionTrigger className="text-lg font-semibold">
                                                {className} (Level {selectedClasses[className]})
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                {features.length === 0 ? (
                                                    <p className='text-sm italic text-muted-foreground px-2'>No features gained at this level for {className}.</p>
                                                ) : (
                                                     <Accordion type="multiple" className="w-full">
                                                         {features.map((feature, index) => (
                                                            <AccordionItem value={`${className}-feature-${index}`} key={feature.name} className="border-b-0 pl-4"> {/* Use stable key */}
                                                                <AccordionTrigger className="text-sm py-2">{feature.name}</AccordionTrigger>
                                                                <AccordionContent className="text-xs text-muted-foreground pb-2">
                                                                    {feature.description}
                                                                    {(feature.maxUses !== null && feature.maxUses !== undefined) && (
                                                                        <p className="text-xs mt-1 text-primary">
                                                                            Uses: {feature.maxUses} (Resets on {feature.usesResetOn || 'N/A'})
                                                                        </p>
                                                                    )}
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        ))}
                                                    </Accordion>
                                                )}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
