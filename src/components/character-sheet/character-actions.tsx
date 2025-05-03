import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Swords } from 'lucide-react';
import type { Character, EquipmentItem, Feature } from '@/lib/types';
import { calculateHitBonus, calculateDamageBonus } from '@/services/rules-service'; // Import calculation functions

interface CharacterActionsProps {
    weapons: EquipmentItem[];
    features: Feature[];
    character: Character; // Pass full character for context if needed
    proficiencyBonus: number;
    onRoll: (diceString: string, label: string) => Promise<number>;
    onUseFeature: (featureName: string) => void;
    isSaving: boolean;
}

export function CharacterActions({
    weapons,
    features,
    character,
    proficiencyBonus,
    onRoll,
    onUseFeature,
    isSaving,
}: CharacterActionsProps) {

    // Use state or memos for derived values if calculations become expensive or need async
    // For now, calculate directly in the render path.

    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Available actions based on equipped items and features.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {weapons.length === 0 && features.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No actions available.</p>
                )}
                {weapons.map((weapon, index) => {
                    // Note: These calculations are now async, but for simple display,
                    // we might need to either make the component async (less ideal for UI)
                    // or trigger the calculation and display a loading state/default value.
                    // For simplicity here, we'll assume sync calculation is acceptable or use a placeholder.
                    // In a real complex app, consider useQuery or similar state management.
                    let hitBonusString = '+?';
                    let damageBonusString = '+?';
                    let damageDiceString = weapon.damageDice ?? 'N/A';

                    // Placeholder: Call async functions - this won't work directly in render.
                    // Needs state/effect or async component pattern.
                    // calculateHitBonus(weapon, character, proficiencyBonus).then(val => hitBonusString = val >= 0 ? `+${val}` : `${val}`);
                    // calculateDamageBonus(weapon, character).then(val => damageBonusString = val >= 0 ? `+${val}` : `${val}`);


                    return (
                        <div key={`weapon-${index}-${weapon.name}`} className="border rounded-md p-3 bg-secondary/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                             <div className='flex-grow'>
                                 <p className="font-medium flex items-center gap-2 flex-wrap">
                                     <Swords className="h-4 w-4 text-primary" />
                                     {weapon.name}
                                      {weapon.properties?.includes('Finesse') && <Badge variant="outline" className='text-xs'>Finesse</Badge>}
                                      {weapon.weaponCategory?.includes('Ranged') && <Badge variant="outline" className='text-xs'>Ranged</Badge>}
                                 </p>
                                 <p className='text-xs text-muted-foreground pl-6'>{weapon.description || weapon.weaponCategory}</p>
                             </div>
                            <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => { // Make async to calculate bonus before roll
                                        const hitBonus = await calculateHitBonus(weapon, character, proficiencyBonus);
                                        onRoll(`1d20+${hitBonus}`, `${weapon.name} Attack`);
                                    }}
                                    title={`Roll 1d20 + Hit Bonus`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M17.1 3.1C16.5 2.5 15.5 2 14 2H6C4.9 2 4 2.9 4 4v8c0 1.5 2.5 2.9 3.1 3.5c0.6 0.6 1.5 1 3 1h8c1.1 0 2-0.9 2-2v-8C22 5.5 19.5 3.1 18.9 2.5z"/><path d="M17 11h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H17c0.3 0 0.5-0.2 0.5-0.5S17.3 11 17 11z"/><path d="M14 8h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H14c0.3 0 0.5-0.2 0.5-0.5S14.3 8 14 8z"/><path d="M11 5h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H11c0.3 0 0.5-0.2 0.5-0.5S11.3 5 11 5z"/></svg>
                                    Hit {/* Display calculated bonus if possible, else placeholder */}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                     onClick={async () => { // Make async
                                         const damageBonus = await calculateDamageBonus(weapon, character);
                                         onRoll(`${weapon.damageDice ?? '0'}+${damageBonus}`, `${weapon.name} Damage`);
                                     }}
                                    title={`Roll ${damageDiceString} + Damage Bonus`}
                                    disabled={!weapon.damageDice}
                                >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M17.1 3.1C16.5 2.5 15.5 2 14 2H6C4.9 2 4 2.9 4 4v8c0 1.5 2.5 2.9 3.1 3.5c0.6 0.6 1.5 1 3 1h8c1.1 0 2-0.9 2-2v-8C22 5.5 19.5 3.1 18.9 2.5z"/><path d="M17 11h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H17c0.3 0 0.5-0.2 0.5-0.5S17.3 11 17 11z"/><path d="M14 8h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H14c0.3 0 0.5-0.2 0.5-0.5S14.3 8 14 8z"/><path d="M11 5h-2.5c-0.3 0-0.5 0.2-0.5 0.5s0.2 0.5 0.5 0.5H11c0.3 0 0.5-0.2 0.5-0.5S11.3 5 11 5z"/></svg>
                                      Dmg: {damageDiceString} {/* Display calculated bonus if possible */}
                                </Button>
                            </div>
                        </div>
                    );
                })}
                {features.map((feature, index) => (
                      <div key={`feature-${index}-${feature.name}`} className="border rounded-md p-3 bg-secondary/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                           <div className='flex-grow'>
                               <p className="font-medium flex items-center gap-2 flex-wrap">
                                    <ShieldCheck className="h-4 w-4 text-accent" />
                                    {feature.name}
                                    <Badge variant="outline" className='text-xs'>{feature.source}</Badge>
                               </p>
                                <p className='text-xs text-muted-foreground pl-6'>
                                    {(typeof feature.description === 'string' && feature.description.length > 0) ? feature.description.split('.')[0] + '.' : ''}
                                </p>
                                {(feature.maxUses !== null && feature.maxUses !== undefined) && (
                                    <p className="text-xs text-primary pl-6 mt-1">
                                         Uses: {feature.currentUses ?? 'N/A'} / {feature.maxUses}
                                    </p>
                                 )}
                           </div>
                          <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                              <Button
                                 size="sm"
                                 variant="default"
                                 onClick={() => onUseFeature(feature.name)}
                                  disabled={(feature.maxUses !== null && feature.maxUses !== undefined && (feature.currentUses ?? 0) <= 0) || isSaving}
                                  title={(feature.maxUses !== null && feature.maxUses !== undefined && (feature.currentUses ?? 0) <= 0) ? 'No uses remaining' : `Use ${feature.name}`}
                               >
                                  Use Feature
                              </Button>
                          </div>
                      </div>
                 ))}
            </CardContent>
        </Card>
    );
}
