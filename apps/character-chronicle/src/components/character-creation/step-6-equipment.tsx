'use client';

import React, { useState, useEffect } from 'react';
import type { PartialCharacterFormData } from './character-creation-wizard';
import type { EquipmentItem, CharacterClass, BackgroundInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, PlusCircle, Trash2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AddEquipmentDialog } from '../add-equipment-dialog'; // Correct relative path
import { useToast } from '@/hooks/use-toast';

interface Step6EquipmentProps {
    data: PartialCharacterFormData;
    updateData: (newData: PartialCharacterFormData) => void;
    setValidity: (isValid: boolean) => void;
    availableItems: EquipmentItem[]; // All items for manual selection
    isLoading: boolean;
    // Need class and background definitions to determine starting equipment
    availableClasses: CharacterClass[];
    availableBackgrounds: string[]; // Just names, need details for equipment
    // TODO: Pass background details or fetch them here based on data.background
}

export function Step6Equipment({
    data,
    updateData,
    setValidity,
    availableItems,
    isLoading,
    availableClasses,
    availableBackgrounds,
}: Step6EquipmentProps) {
    const [useStartingEquipment, setUseStartingEquipment] = useState<boolean>(true);
    const [manualEquipment, setManualEquipment] = useState<EquipmentItem[]>(data.equipment || []);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const { toast } = useToast();

    // Determine starting equipment based on class and background
    // This is simplified - real logic might involve choices
    const getStartingEquipment = (): EquipmentItem[] => {
        let starting: EquipmentItem[] = [];
        // Class equipment
        const selectedClassDef = availableClasses.find(c => c.name === data.class);
        if (selectedClassDef) {
             // TODO: Implement logic to handle equipment choices from class definition
             // This is a placeholder - actual starting equipment is more complex
             console.warn("Class starting equipment logic not fully implemented.");
             // Example: Add a weapon based on proficiency
             if (selectedClassDef.proficiencies.weapons.includes("Longsword")) {
                 starting.push({ name: "Longsword", quantity: 1, type: "Weapon" });
             } else if (selectedClassDef.proficiencies.weapons.includes("Shortbow")) {
                 starting.push({ name: "Shortbow", quantity: 1, type: "Weapon" });
                  starting.push({ name: "Arrows (20)", quantity: 1, type: "Adventuring Gear" }); // Assuming arrows come with bow
             }
              // Add a generic pack maybe
              starting.push({ name: "Explorer's Pack", quantity: 1, type: 'Adventuring Gear' });
        }

        // Background equipment
        // TODO: Fetch background details to get equipment list
        if (data.background) {
            console.warn("Background starting equipment logic not implemented (requires details fetch).");
             // Example: Add gold pouch based on generic background idea
              starting.push({ name: "Belt Pouch", quantity: 1, type: 'Adventuring Gear' });
              starting.push({ name: "Gold Pieces", quantity: 15, type: 'Currency' }); // Add currency type
        }

         // Deduplicate and potentially merge quantities if needed
        const mergedStarting: EquipmentItem[] = [];
        starting.forEach(item => {
            const existing = mergedStarting.find(i => i.name === item.name);
            if (existing) {
                existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
            } else {
                mergedStarting.push({ ...item, quantity: item.quantity || 1 });
            }
        });

        return mergedStarting;
    };

    const startingEquipment = getStartingEquipment();

    // Update main data based on selection type
    useEffect(() => {
        updateData({
            equipment: useStartingEquipment ? startingEquipment : manualEquipment,
        });
        // Basic validation: Allow proceeding regardless of equipment choice
        setValidity(true);
    }, [useStartingEquipment, startingEquipment, manualEquipment, updateData, setValidity]);

    const handleAddItem = (itemToAdd: EquipmentItem) => {
        setManualEquipment(prev => {
            const updated = [...prev];
            const existingIndex = updated.findIndex(item => item.name === itemToAdd.name);
            if (existingIndex > -1) {
                updated[existingIndex].quantity = (updated[existingIndex].quantity || 1) + (itemToAdd.quantity || 1);
            } else {
                updated.push({ ...itemToAdd, quantity: itemToAdd.quantity || 1 });
            }
            return updated;
        });
    };

    const handleRemoveItem = (indexToRemove: number) => {
        setManualEquipment(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Equipment</CardTitle>
                    <CardDescription>Choose starting equipment or select items manually.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="use-starting-equipment"
                            checked={useStartingEquipment}
                            onCheckedChange={(checked) => setUseStartingEquipment(Boolean(checked))}
                        />
                        <Label htmlFor="use-starting-equipment">Use Starting Equipment (from Class & Background)</Label>
                    </div>

                    {useStartingEquipment ? (
                        <Card className="bg-muted/50 p-4">
                            <CardTitle className="text-base mb-2">Starting Package</CardTitle>
                            {startingEquipment.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">No starting equipment defined for selected class/background.</p>
                            ) : (
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    {startingEquipment.map((item, index) => (
                                        <li key={`${item.name}-${index}`}>
                                            {item.name} {item.quantity && item.quantity > 1 ? `(x${item.quantity})` : ''}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    ) : (
                        <Card className="p-4 border">
                            <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between">
                                <CardTitle className="text-base">Manually Added Equipment</CardTitle>
                                <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[300px] w-full pr-4">
                                    {manualEquipment.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">No items added manually.</p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {manualEquipment.map((item, index) => (
                                                <li key={`${item.name}-${index}`} className="flex items-center justify-between text-sm py-1 border-b border-dashed last:border-b-0">
                                                    <span className="font-medium truncate" title={item.name}>
                                                        {item.name} {item.quantity && item.quantity > 1 ? `(x${item.quantity})` : ''}
                                                    </span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive-hover" onClick={() => handleRemoveItem(index)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>

            {/* Add Equipment Dialog */}
            <AddEquipmentDialog
                isOpen={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                availableItems={availableItems}
                onAddItem={handleAddItem}
                isLoadingItems={isLoading}
            />
        </div>
    );
}
