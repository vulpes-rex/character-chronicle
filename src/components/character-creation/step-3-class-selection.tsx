
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { CharacterClass, Feature } from '@/lib/types';
import { getCumulativeClassFeatures } from '@/services/dnd-api'; // Keep using this


interface Step3Props {
    data: PartialCharacterFormData;
    updateData: (data: Pick<PartialCharacterFormData, 'class' | 'level' | 'selectedClasses' | 'tempFeatures' | 'tempProficiencies'>) => void;
    setValidity: (isValid: boolean) => void;
    availableClasses: CharacterClass[];
}

export function Step3ClassSelection({ data, updateData, setValidity, availableClasses }: Step3Props) {
    const [selectedClasses, setSelectedClasses] = useState<{ [key: string]: number }>(data.selectedClasses || {});
    const [allClassFeatures, setAllClassFeatures] = useState<{ [key: string]: Feature[] }>({});
    const [isLoadingFeatures, setIsLoadingFeatures] = useState(false);
    const [featureError, setFeatureError] = useState<string | null>(null);

    const totalLevel = Object.values(selectedClasses).reduce((sum, lvl) => sum + lvl, 0);
    const maxLevelReached = totalLevel >= 20;

    // Update overall validity
    useEffect(() => {
        setValidity(totalLevel > 0 && totalLevel <= 20 && !isLoadingFeatures);
    }, [totalLevel, isLoadingFeatures, setValidity]);


    // Function to fetch and update features for selected classes and levels
    const fetchAndUpdateFeatures = useCallback(async () => {
        setIsLoadingFeatures(true);
        setFeatureError(null);
        const featuresByClass: { [key: string]: Feature[] } = {};
        const allProficiencies: PartialCharacterFormData['tempProficiencies'] = {
            armor: [...(data.tempProficiencies?.armor?.filter(p => !p.endsWith('(Class)')) ?? [])],
            weapons: [...(data.tempProficiencies?.weapons?.filter(p => !p.endsWith('(Class)')) ?? [])],
            tools: [...(data.tempProficiencies?.tools?.filter(p => !p.endsWith('(Class)')) ?? [])],
            savingThrows: [...(data.tempProficiencies?.savingThrows ?? [])], // Assume saving throws come only from the first class
        };
        const allFeatures: Feature[] = [...(data.tempFeatures?.filter(f => f.source !== 'Class') ?? [])];

        try {
            let isFirstClass = true;
            for (const [className, level] of Object.entries(selectedClasses)) {
                const classData = availableClasses.find(c => c.name === className);
                if (!classData || level <= 0) continue;

                const features = await getCumulativeClassFeatures(className, level);
                featuresByClass[className] = features;
                allFeatures.push(...features.map(f => ({ ...f, source: 'Class' }))); // Tag source

                // Add class proficiencies (handle potential duplicates)
                allProficiencies.armor = [...new Set([...allProficiencies.armor!, ...classData.proficiencies.armor.map(p => `${p} (Class)`)])];
                allProficiencies.weapons = [...new Set([...allProficiencies.weapons!, ...classData.proficiencies.weapons.map(p => `${p} (Class)`)])];
                allProficiencies.tools = [...new Set([...allProficiencies.tools!, ...(classData.proficiencies.tools ?? []).map(p => `${p} (Class)`)])];

                // Only add saving throws from the *first* class selected
                if (isFirstClass) {
                    allProficiencies.savingThrows = [...new Set([...allProficiencies.savingThrows!, ...classData.proficiencies.savingThrows])];
                    isFirstClass = false;
                }
            }
            setAllClassFeatures(featuresByClass);

            // Update parent state
            updateData({
                class: Object.keys(selectedClasses)[0] || '', // Set primary class
                level: totalLevel || 1,
                selectedClasses: selectedClasses,
                tempFeatures: allFeatures,
                tempProficiencies: allProficiencies,
            });

        } catch (error) {
             console.error("Error fetching class features:", error);
             setFeatureError(error instanceof Error ? error.message : "Failed to load class features.");
        } finally {
            setIsLoadingFeatures(false);
        }
    }, [selectedClasses, availableClasses, updateData, data.tempFeatures, data.tempProficiencies]);


    // Re-fetch features when selected classes or levels change
    useEffect(() => {
        if (Object.keys(selectedClasses).length > 0) {
            fetchAndUpdateFeatures();
        } else {
             // Clear features and proficiencies if no classes are selected
             setAllClassFeatures({});
             updateData({
                 class: '',
                 level: 1,
                 selectedClasses: {},
                 tempFeatures: data.tempFeatures?.filter(f => f.source !== 'Class') ?? [],
                 tempProficiencies: {
                     ...data.tempProficiencies,
                     armor: data.tempProficiencies?.armor?.filter(p => !p.endsWith('(Class)')) ?? [],
                     weapons: data.tempProficiencies?.weapons?.filter(p => !p.endsWith('(Class)')) ?? [],
                     tools: data.tempProficiencies?.tools?.filter(p => !p.endsWith('(Class)')) ?? [],
                     savingThrows: [], // Clear saving throws if no class
                 },
             });
             setIsLoadingFeatures(false);
             setFeatureError(null);
        }
    }, [selectedClasses, fetchAndUpdateFeatures, updateData, data.tempFeatures, data.tempProficiencies]); // Dependency array includes selectedClasses and the fetch function


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
                                                key={c.name}
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
                                                <SelectItem key={lvl} value={String(lvl)} disabled={isDisabled}>
                                                    Lvl {lvl}
                                                </SelectItem>
                                             );
                                        })}
                                      </SelectContent>
                                </Select>
                                <Button
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
                    <CardContent className='text-xs space-y-1'>
                        <p><strong>Saving Throws:</strong> {data.tempProficiencies?.savingThrows?.join(', ') || 'None'}</p>
                        <p><strong>Armor:</strong> {data.tempProficiencies?.armor?.map(p=>p.replace(' (Class)','')).join(', ') || 'None'}</p>
                        <p><strong>Weapons:</strong> {data.tempProficiencies?.weapons?.map(p=>p.replace(' (Class)','')).join(', ') || 'None'}</p>
                        <p><strong>Tools:</strong> {data.tempProficiencies?.tools?.map(p=>p.replace(' (Class)','')).join(', ') || 'None'}</p>
                    </CardContent>
                 </Card>
            </div>

            {/* Feature Display Area */}
            <div className="md:col-span-2">
                <Card className="h-[600px] flex flex-col"> {/* Fixed height */}
                    <CardHeader>
                        <CardTitle>Class Features</CardTitle>
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
                                        <AccordionItem value={className} key={className}>
                                            <AccordionTrigger className="text-lg font-semibold">
                                                {className} (Level {selectedClasses[className]})
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                {features.length === 0 ? (
                                                    <p className='text-sm italic text-muted-foreground px-2'>No features gained at this level for {className}.</p>
                                                ) : (
                                                     <Accordion type="multiple" className="w-full">
                                                         {features.map((feature, index) => (
                                                            <AccordionItem value={`${className}-feature-${index}`} key={feature.name} className="border-b-0 pl-4">
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
