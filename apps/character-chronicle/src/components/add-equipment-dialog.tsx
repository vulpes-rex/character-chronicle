
    'use client';

    import { useState } from 'react';
    import { Button } from '@/components/ui/button'; // Use alias
    import {
      Dialog,
      DialogContent,
      DialogDescription,
      DialogHeader,
      DialogTitle,
      DialogFooter,
      DialogClose,
    } from '@/components/ui/dialog'; // Use alias
    import {
      Select,
      SelectContent,
      SelectItem,
      SelectTrigger,
      SelectValue,
    } from '@/components/ui/select'; // Use alias
    import { Input } from '@/components/ui/input'; // Use alias
    import { Label } from '@/components/ui/label'; // Use alias
    import { ScrollArea } from '@/components/ui/scroll-area'; // Use alias
    import { Skeleton } from '@/components/ui/skeleton'; // Use alias
    import { useToast } from '@/hooks/use-toast'; // Use alias
    import type { EquipmentItem } from '@/services/dnd-api'; // Use alias
    import { AlertCircle } from 'lucide-react';

    interface AddEquipmentDialogProps {
      isOpen: boolean;
      onOpenChange: (open: boolean) => void;
      availableItems: EquipmentItem[];
      onAddItem: (item: EquipmentItem) => void;
      isLoadingItems: boolean;
    }

    export function AddEquipmentDialog({
      isOpen,
      onOpenChange,
      availableItems,
      onAddItem,
      isLoadingItems,
    }: AddEquipmentDialogProps) {
      const [selectedItemName, setSelectedItemName] = useState<string | undefined>(undefined);
      const [quantity, setQuantity] = useState<number>(1);
      const [customItemName, setCustomItemName] = useState('');
      const [customItemDescription, setCustomItemDescription] = useState('');
      const [isAddingCustom, setIsAddingCustom] = useState(false);
      const { toast } = useToast();

      const selectedItemDetails = availableItems.find(item => item.name === selectedItemName);

      const handleAddItemClick = () => {
        let itemToAdd: EquipmentItem | null = null;

        if (isAddingCustom) {
          if (!customItemName.trim()) {
             toast({ variant: 'destructive', title: 'Error', description: 'Custom item name cannot be empty.' });
             return;
          }
           itemToAdd = {
             name: customItemName.trim(),
             description: customItemDescription.trim() || undefined,
             quantity: quantity,
           };
        } else {
            if (!selectedItemDetails) {
              toast({ variant: 'destructive', title: 'Error', description: 'Please select an item.' });
              return;
            }
             itemToAdd = { ...selectedItemDetails, quantity: quantity };
        }


        if (itemToAdd) {
            onAddItem(itemToAdd);
            toast({ title: 'Item Added', description: `${itemToAdd.name} (x${itemToAdd.quantity}) added to equipment.` });
            resetForm();
            // Optionally close dialog on successful add
            // onOpenChange(false);
        }
      };

      const resetForm = () => {
         setSelectedItemName(undefined);
         setQuantity(1);
         setCustomItemName('');
         setCustomItemDescription('');
         setIsAddingCustom(false);
      }

      const handleOpenChangeWithReset = (open: boolean) => {
          if (!open) {
              resetForm();
          }
          onOpenChange(open);
      }

      return (
        <Dialog open={isOpen} onOpenChange={handleOpenChangeWithReset}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Add Equipment</DialogTitle>
              <DialogDescription>
                {isAddingCustom
                    ? 'Enter details for a custom item.'
                    : 'Select an item from the list or switch to add a custom one.'}
              </DialogDescription>
            </DialogHeader>

            {isLoadingItems ? (
               <div className="space-y-4 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-8 w-20" />
               </div>
            ) : (
              <div className="grid gap-4 py-4">
                 {isAddingCustom ? (
                    <>
                        <div className="grid grid-cols-4 items-center gap-4">
                           <Label htmlFor="custom-name" className="text-right col-span-1">
                               Name
                           </Label>
                           <Input
                               id="custom-name"
                               value={customItemName}
                               onChange={(e) => setCustomItemName(e.target.value)}
                               className="col-span-3"
                               placeholder="e.g., Mysterious Amulet"
                           />
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="custom-desc" className="text-right col-span-1">
                                Description
                            </Label>
                            <Input
                                id="custom-desc"
                                value={customItemDescription}
                                onChange={(e) => setCustomItemDescription(e.target.value)}
                                className="col-span-3"
                                placeholder="(Optional)"
                            />
                        </div>
                     </>
                 ) : (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="item-select" className="text-right col-span-1">
                          Item
                        </Label>
                        <Select value={selectedItemName} onValueChange={setSelectedItemName}>
                          <SelectTrigger id="item-select" className="col-span-3">
                            <SelectValue placeholder="Select an item..." />
                          </SelectTrigger>
                          <SelectContent>
                            <ScrollArea className="h-[200px]">
                                {availableItems.length > 0 ? (
                                    availableItems.map((item) => (
                                    <SelectItem key={item.name} value={item.name}>
                                        {item.name} {item.description ? `(${item.description})` : ''}
                                    </SelectItem>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-sm text-muted-foreground">No items found.</div>
                                )}
                            </ScrollArea>
                          </SelectContent>
                        </Select>
                      </div>
                 )}

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="quantity" className="text-right col-span-1">
                    Quantity
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="col-span-3"
                  />
                </div>
              </div>
            )}

            <DialogFooter className='flex-col sm:flex-row sm:justify-between gap-2'>
                <Button variant="link" onClick={() => setIsAddingCustom(!isAddingCustom)} className='order-last sm:order-first'>
                    {isAddingCustom ? 'Select Standard Item' : 'Add Custom Item'}
                 </Button>
               <div className="flex gap-2">
                    <DialogClose asChild>
                       <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleAddItemClick} disabled={isLoadingItems || (isAddingCustom ? !customItemName.trim() : !selectedItemName)}>
                        Add Item
                    </Button>
               </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }
    