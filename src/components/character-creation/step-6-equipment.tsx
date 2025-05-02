
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
import type { EquipmentItem } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { getAvailableEquipmentItems } from '@/services/dnd-api'; // Assuming this fetches all items
import { AddEquipmentDialog } from '@/components/add-equipment-dialog'; // Reuse dialog

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
}

export function Step6Equipment({ data, updateData, setValidity }: Step6Props) {
    const [selectionMode, setSelectionMode] = useState<'starting' | 'manual'>('starting');
    const [manualEquipment, setManualEquipment] = useState<EquipmentItem[]>(data.equipment as EquipmentItem[] || []);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

     // Fetch all available items for the manual selection dialog
     const { data: allItems = [], isLoading: isLoadingItems } = useQuery<EquipmentItem[], Error>({
         queryKey: ['availableEquipment'],
         queryFn: getAvailableEquipmentItems,
         staleTime: 60 * 60 * 1000, // Cache for an hour
     });

    // Update parent data based on mode and manual list
    useEffect(() => {
        if (selectionMode === 'starting') {
            // TODO: Replace MOCK_STARTING_EQUIPMENT with actual calculated starting gear
             // based on data.class and data.background
            updateData({ equipment: MOCK_STARTING_EQUIPMENT.map(item => ({ ...item, isEquipped: false, quantity: item.quantity || 1 })) });
        } else {
            updateData({ equipment: manualEquipment });
        }
        // Validity is always true for this step as selection is always possible
        setValidity(true);
    }, [selectionMode, manualEquipment, updateData, setValidity]);

    const handleAddItem = (item: EquipmentItem) => {
         setManualEquipment(prev => {
             const existingIndex = prev.findIndex(i => i.name === item.name);
             if (existingIndex > -1) {
                 // Update quantity if item exists
                 const updated = [...prev];
                 updated[existingIndex] = { ...updated[existingIndex], quantity: (updated[existingIndex].quantity || 1) + (item.quantity || 1) };
                 return updated;
             } else {
                 // Add new item
                 return [...prev, { ...item, isEquipped: false, quantity: item.quantity || 1 }];
             }
         });
    };

    const handleRemoveItem = (itemName: string) => {
        setManualEquipment(prev => prev.filter(item => item.name !== itemName));
    };

     const handleUpdateQuantity = (itemName: string, quantity: number) => {
        const newQuantity = Math.max(0, quantity); // Ensure quantity is not negative
         setManualEquipment(prev =>
            prev.map(item =>
                item.name === itemName ? { ...item, quantity: newQuantity } : item
            ).filter(item => item.quantity > 0) // Remove if quantity becomes 0
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
                                <CardDescription>Based on your selected class and background (placeholder).</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    {MOCK_STARTING_EQUIPMENT.map((item, index) => (
                                        <li key={index}>{item.name} {item.quantity && item.quantity > 1 ? `(x${item.quantity})` : ''} {item.description ? `- ${item.description}`: ''}</li>
                                    ))}
                                    {/* TODO: Add starting gold based on background */}
                                    <li>15 gp (from Acolyte background)</li>
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {selectionMode === 'manual' && (
                        <Card>
                            <CardHeader className='flex flex-row justify-between items-center pb-2'>
                                <CardTitle className="text-lg">Manual Selection</CardTitle>
                                <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
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

            {/* Add Equipment Dialog */}
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
