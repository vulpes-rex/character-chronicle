
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Trash2, PlusCircle } from 'lucide-react';
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { EquipmentItem, SourcePack } from '@/lib/types'; // Added SourcePack type
import { useQuery } from '@tanstack/react-query';
import { getAvailableEquipmentItems } from '@/services/dnd-api'; // Keep using this
import { AddEquipmentDialog } from '@/components/add-equipment-dialog';

// Mock starting equipment (replace with logic based on selected class/background)
const MOCK_STARTING_EQUIPMENT: EquipmentItem[] = [
    { name: 'Explorer\'s Pack', quantity: 1, description: '(Includes backpack, bedroll, etc.)'},
    { name: 'Longsword', quantity: 1 },
    { name: 'Shield', quantity: 1 },
    { name: 'Set of Common Clothes', quantity: 1 },
    { name: 'Belt Pouch', quantity: 1 },
];


interface Step6Props {
    data: PartialCharacterFormData;
    updateData: (data: Pick<PartialCharacterFormData, 'equipment'>) => void;
    setValidity: (isValid: boolean) => void;
    combinedContent?: SourcePack['content']; // Add combinedContent prop
}

export function Step6Equipment({ data, updateData, setValidity, combinedContent }: Step6Props) {
    const [selectionMode, setSelectionMode] = useState<'starting' | 'manual'>('starting');
    const [manualEquipment, setManualEquipment] = useState<EquipmentItem[]>(data.equipment as EquipmentItem[] || []);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

     // Fetch all available items using combinedContent
     const { data: allItems = [], isLoading: isLoadingItems } = useQuery<EquipmentItem[], Error>({
         queryKey: ['availableEquipment', combinedContent], // Include combinedContent in key
         queryFn: () => getAvailableEquipmentItems(combinedContent), // Pass combinedContent
         enabled: !!combinedContent, // Enable only when content is loaded
         staleTime: 60 * 60 * 1000, // Cache for an hour
     });

    // TODO: Calculate actual starting equipment based on class/background from combinedContent
    const calculatedStartingEquipment = useMemo(() => {
        // Placeholder: Use mock data for now
        // In a real implementation, look up classData and backgroundData in combinedContent
        // and determine the starting equipment based on their definitions.
        const classData = combinedContent?.classes?.[data.class || ''];
        const backgroundData = combinedContent?.backgrounds?.[data.background || ''];
        let startingItems: EquipmentItem[] = [...MOCK_STARTING_EQUIPMENT]; // Start with mock or default
        let startingGold = 0;

        if (backgroundData) {
             startingGold = backgroundData.startingGold || 0;
             // Add background equipment (need to fetch full item details from allItems)
             (backgroundData.equipment || []).forEach(itemName => {
                const itemDef = allItems.find(i => i.name === itemName);
                if (itemDef) {
                    startingItems.push({ ...itemDef, quantity: 1 }); // Assume quantity 1 for background items
                } else {
                     startingItems.push({ name: itemName, quantity: 1, type: 'Adventuring Gear' }); // Add as basic item if definition not found
                }
             });
        }
        // TODO: Add logic for class starting equipment choices

         // Add starting gold as an item
        if (startingGold > 0) {
            startingItems.push({ name: 'Gold Pieces (gp)', quantity: startingGold, type: 'Currency' });
        }

         // Consolidate items by name
        const consolidated: Record<string, EquipmentItem> = {};
        startingItems.forEach(item => {
             if (consolidated[item.name]) {
                 consolidated[item.name].quantity = (consolidated[item.name].quantity || 1) + (item.quantity || 1);
             } else {
                 consolidated[item.name] = { ...item, quantity: item.quantity || 1 };
             }
        });


        return Object.values(consolidated).map(item => ({ ...item, isEquipped: false }));

    }, [data.class, data.background, combinedContent, allItems]); // Depend on relevant data


    useEffect(() => {
        let equipmentToUpdate: EquipmentItem[];

        if (selectionMode === 'starting') {
            equipmentToUpdate = calculatedStartingEquipment;
        } else {
            equipmentToUpdate = manualEquipment;
        }

        if (JSON.stringify(equipmentToUpdate) !== JSON.stringify(data.equipment)) {
             console.log("Step 6: Updating parent data");
            updateData({ equipment: equipmentToUpdate });
        }

        setValidity(true); // Step is always valid

    }, [selectionMode, manualEquipment, calculatedStartingEquipment, updateData, setValidity, data.equipment]);


    const handleAddItem = (item: EquipmentItem) => {
         setManualEquipment(prev => {
             const existingIndex = prev.findIndex(i => i.name === item.name);
             if (existingIndex > -1) {
                 const updated = [...prev];
                 updated[existingIndex] = { ...updated[existingIndex], quantity: (updated[existingIndex].quantity || 1) + (item.quantity || 1) };
                 return updated;
             } else {
                 return [...prev, { ...item, isEquipped: false, quantity: item.quantity || 1 }];
             }
         });
    };

    const handleRemoveItem = (itemName: string) => {
        setManualEquipment(prev => prev.filter(item => item.name !== itemName));
    };

     const handleUpdateQuantity = (itemName: string, quantity: number) => {
        const newQuantity = Math.max(0, quantity);
         setManualEquipment(prev =>
            prev.map(item =>
                item.name === itemName ? { ...item, quantity: newQuantity } : item
            ).filter(item => item.quantity > 0)
         );
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Starting Equipment</CardTitle>
                    <CardDescription>Choose your starting equipment package or select items manually.</CardDescription>
                </CardHeader>
                <CardContent>
                    <RadioGroup value={selectionMode} onValueChange={(value) => setSelectionMode(value as 'starting' | 'manual')} className="mb-6">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="starting" id="starting" />
                            <Label htmlFor="starting">Use Starting Equipment Package</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="manual" id="manual" />
                            <Label htmlFor="manual">Select Equipment Manually</Label>
                        </div>
                    </RadioGroup>

                    {selectionMode === 'starting' && (
                        <Card className="bg-secondary/50">
                            <CardHeader>
                                <CardTitle className="text-lg">Starting Package</CardTitle>
                                <CardDescription>Based on your selected class ({data.class || 'None'}) and background ({data.background || 'None'}).</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoadingItems ? (
                                    <Skeleton className="h-20 w-full" />
                                ) : (
                                     <ul className="list-disc pl-5 space-y-1 text-sm">
                                        {calculatedStartingEquipment.map((item, index) => (
                                             <li key={index}>{item.name} {item.quantity && item.quantity > 1 ? `(x${item.quantity})` : ''} {item.description ? `- ${item.description}`: ''}</li>
                                        ))}
                                        {calculatedStartingEquipment.length === 0 && <li className='italic text-muted-foreground'>No starting equipment defined.</li>}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {selectionMode === 'manual' && (
                        <Card>
                            <CardHeader className='flex flex-row justify-between items-center pb-2'>
                                <CardTitle className="text-lg">Manual Selection</CardTitle>
                                <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)} disabled={isLoadingItems}>
                                     <PlusCircle className="mr-2 h-4 w-4"/> Add Item
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {manualEquipment.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">No equipment added yet.</p>
                                ) : (
                                    <ScrollArea className="h-[300px] w-full pr-4">
                                        <ul className="space-y-2">
                                             {manualEquipment.map((item, index) => (
                                                <li key={`${item.name}-${index}`} className="flex items-center justify-between group border-b pb-2 last:border-b-0">
                                                     <div className='flex items-center gap-2 flex-grow min-w-0'>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity || 1}
                                                             onChange={(e) => handleUpdateQuantity(item.name, parseInt(e.target.value))}
                                                            className="w-12 h-7 text-sm text-center px-1 py-0 shrink-0"
                                                            aria-label={`${item.name} quantity`}
                                                         />
                                                        <div className='flex flex-col min-w-0'>
                                                             <span className="text-sm font-medium truncate">{item.name}</span>
                                                             {item.description && (
                                                                 <span className="text-xs text-muted-foreground truncate" title={item.description}>
                                                                     {item.description}
                                                                 </span>
                                                             )}
                                                         </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0 ml-2"
                                                        onClick={() => handleRemoveItem(item.name)}
                                                        aria-label={`Remove ${item.name}`}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </li>
                                             ))}
                                         </ul>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>

            <AddEquipmentDialog
                 isOpen={isAddDialogOpen}
                 onOpenChange={setIsAddDialogOpen}
                 availableItems={allItems}
                 onAddItem={handleAddItem}
                 isLoadingItems={isLoadingItems}
             />
        </div>
    );
}
