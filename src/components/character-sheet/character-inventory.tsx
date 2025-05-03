import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { EquipmentItem } from '@/lib/types';

interface CharacterInventoryProps {
    equipment: EquipmentItem[];
    onToggleEquip: (itemName: string) => void;
    onUpdateQuantity: (itemName: string, quantity: number) => void;
    onRemoveItem: (itemName: string) => void;
    onAddItemClick: () => void;
    isSaving: boolean;
    isLoadingEquipment: boolean;
}

export function CharacterInventory({
    equipment,
    onToggleEquip,
    onUpdateQuantity,
    onRemoveItem,
    onAddItemClick,
    isSaving,
    isLoadingEquipment,
}: CharacterInventoryProps) {
    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Equipment</CardTitle>
                <Button variant="ghost" size="icon" onClick={onAddItemClick} aria-label="Add Equipment" disabled={isSaving || isLoadingEquipment}>
                    <PlusCircle className="h-5 w-5" />
                </Button>
            </CardHeader>
            <CardContent>
                {equipment.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No equipment added yet.</p>
                ) : (
                    <ScrollArea className="h-[400px] w-full">
                        <ul className="space-y-2 pr-4">
                            {equipment.map((item, index) => (
                                <li key={`${item.name}-${index}`} className="flex items-center justify-between group border-b pb-2 last:border-b-0">
                                    <div className='flex items-center gap-2 flex-grow min-w-0'>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => onUpdateQuantity(item.name, parseInt(e.target.value))}
                                            className="w-12 h-7 text-sm text-center px-1 py-0 shrink-0"
                                            aria-label={`${item.name} quantity`}
                                            disabled={isSaving}
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
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        {(item.type === 'Weapon' || item.type === 'Armor') && (
                                            <Button
                                                variant={item.isEquipped ? "secondary" : "outline"}
                                                size="xs"
                                                className='h-6 px-1.5 text-xs'
                                                onClick={() => onToggleEquip(item.name)}
                                                title={item.isEquipped ? `Unequip ${item.name}` : `Equip ${item.name}`}
                                                disabled={isSaving}
                                            >
                                                {item.isEquipped ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                            onClick={() => onRemoveItem(item.name)}
                                            aria-label={`Remove ${item.name}`}
                                            disabled={isSaving}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
