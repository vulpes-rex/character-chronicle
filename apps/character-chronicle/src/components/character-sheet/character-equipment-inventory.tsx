'use client';

import React, { useState } from 'react';
import type { Character, EquipmentItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, PlusCircle } from 'lucide-react';
import { AddEquipmentDialog } from '../add-equipment-dialog'; // Corrected relative path
import { useToast } from '@/hooks/use-toast';
import { updateCharacterAction, loadCharacterAction } from '@/app/actions/character-actions'; // Use server action
import { useAuth } from '../auth-provider'; // Corrected relative path

interface CharacterEquipmentInventoryProps {
    characterId: string;
    playerId: string | null;
    equipment: Character['equipment'];
    availableItems: EquipmentItem[]; // Pass all available items for the dialog
    isLoadingItems: boolean; // Indicate if items are loading
    onCharacterUpdate: (updatedCharacter: Character | null) => void; // Callback to update parent state
     characterData: Character; // Pass the full character data for fallback updates
}

export function CharacterEquipmentInventory({
    characterId,
    playerId,
    equipment,
    availableItems,
    isLoadingItems,
    onCharacterUpdate,
     characterData, // Receive character data
}: CharacterEquipmentInventoryProps) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth(); // Needed for update action permission check

    const handleAddItem = async (itemToAdd: EquipmentItem) => {
        if (!user || user.uid !== playerId) {
             toast({ variant: "destructive", title: "Error", description: "Not authorized to modify this character." });
             return;
        }
        const updatedEquipment = [...(equipment || [])]; // Handle case where equipment might be initially undefined
        // Check if item already exists to stack quantity
        const existingItemIndex = updatedEquipment.findIndex(item => item.name === itemToAdd.name);

        if (existingItemIndex > -1) {
            updatedEquipment[existingItemIndex].quantity = (updatedEquipment[existingItemIndex].quantity || 1) + (itemToAdd.quantity || 1);
        } else {
            updatedEquipment.push({ ...itemToAdd, quantity: itemToAdd.quantity || 1, isEquipped: false }); // Add new item, ensure quantity defaults if needed
        }

        try {
            const result = await updateCharacterAction(characterId, { equipment: updatedEquipment }, user.uid);
             if (result.success) {
                 // Fetch updated character to refresh the whole sheet state via callback
                  const updatedCharResult = await loadCharacterAction(characterId); // Assumes loadCharacterAction exists
                  if (updatedCharResult.success && updatedCharResult.character) {
                     onCharacterUpdate(updatedCharResult.character);
                     toast({ title: "Item Added", description: `${itemToAdd.name} added.` });
                  } else {
                     // Fallback: update local state partially if reload fails
                     toast({ title: "Item Added (Local Update)", description: `${itemToAdd.name} added locally, but failed to reload full sheet.` });
                     onCharacterUpdate({ ...characterData, equipment: updatedEquipment }); // Pass current character data with updated equipment
                  }
             } else {
                 throw new Error(result.error || 'Failed to update equipment.');
             }
         } catch (error: any) {
             toast({ variant: "destructive", title: "Error Adding Item", description: error.message });
         }
    };

    const handleRemoveItem = async (indexToRemove: number) => {
         if (!user || user.uid !== playerId) return;
         const updatedEquipment = (equipment || []).filter((_, index) => index !== indexToRemove);
         try {
             const result = await updateCharacterAction(characterId, { equipment: updatedEquipment }, user.uid);
              if (result.success) {
                 // Reload character or update locally
                 const updatedCharResult = await loadCharacterAction(characterId);
                 if (updatedCharResult.success && updatedCharResult.character) {
                    onCharacterUpdate(updatedCharResult.character);
                     toast({ title: "Item Removed" });
                 } else {
                     toast({ title: "Item Removed (Local Update)", description: "Failed to reload full sheet." });
                    onCharacterUpdate({ ...characterData, equipment: updatedEquipment });
                 }
              } else {
                  throw new Error(result.error || 'Failed to remove item.');
              }
         } catch (error: any) {
             toast({ variant: "destructive", title: "Error Removing Item", description: error.message });
         }
    };

    const handleToggleEquip = async (indexToToggle: number) => {
         if (!user || user.uid !== playerId) return;
         const updatedEquipment = (equipment || []).map((item, index) =>
             index === indexToToggle ? { ...item, isEquipped: !item.isEquipped } : item
         );
         try {
             const result = await updateCharacterAction(characterId, { equipment: updatedEquipment }, user.uid);
              if (result.success) {
                 // Reload character or update locally
                  const updatedCharResult = await loadCharacterAction(characterId);
                  if (updatedCharResult.success && updatedCharResult.character) {
                     onCharacterUpdate(updatedCharResult.character);
                  } else {
                      toast({ title: "Equip Status Changed (Local Update)", description: "Failed to reload full sheet." });
                     onCharacterUpdate({ ...characterData, equipment: updatedEquipment });
                  }
              } else {
                  throw new Error(result.error || 'Failed to toggle equip status.');
              }
         } catch (error: any) {
             toast({ variant: "destructive", title: "Error Equipping Item", description: error.message });
         }
    };


    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>Equipment & Inventory</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[300px] w-full pr-4"> {/* Adjust height as needed */}
                        {(equipment || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Inventory is empty.</p>
                        ) : (
                            <ul className="space-y-2">
                                {(equipment || []).map((item, index) => (
                                    <li key={`${item.name}-${index}`} className="flex items-center justify-between text-sm py-1 border-b border-dashed last:border-b-0">
                                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                                             <Checkbox
                                                 id={`equip-${index}`}
                                                 checked={item.isEquipped}
                                                 onCheckedChange={() => handleToggleEquip(index)}
                                                 disabled={!item.type || (item.type !== 'Weapon' && item.type !== 'Armor')} // Only allow equipping weapons/armor
                                                 title={item.type === 'Weapon' || item.type === 'Armor' ? (item.isEquipped ? 'Unequip' : 'Equip') : 'Cannot equip this item type'}
                                             />
                                            <span className="font-medium truncate" title={item.name}>
                                                {item.name} {item.quantity && item.quantity > 1 ? `(x${item.quantity})` : ''}
                                            </span>
                                            {item.description && (
                                                <span className="text-xs text-muted-foreground truncate hidden sm:inline" title={item.description}>- {item.description}</span>
                                            )}
                                        </div>
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

            {/* Add Equipment Dialog */}
             <AddEquipmentDialog
                 isOpen={isAddDialogOpen}
                 onOpenChange={setIsAddDialogOpen}
                 availableItems={availableItems}
                 onAddItem={handleAddItem}
                 isLoadingItems={isLoadingItems}
             />
        </>
    );
}
