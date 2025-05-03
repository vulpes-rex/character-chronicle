'use client';

import React from 'react';
import type { Character, EquipmentItem, Feature } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useDiceRoller } from '@/components/dice-roll-context'; // Fix import path
import { calculateHitBonusAction, calculateDamageBonusAction } from '@/app/actions/rules-actions'; // Use server actions
import { useFeatureAction, castSpellAction } from '@/app/actions/character-actions'; // Use server actions
import { useToast } from '@/hooks/use-toast';
import { Dices, WandSparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface CharacterActionsSectionProps {
    character: Character;
    onCharacterUpdate: (updatedCharacter: Character | null) => void; // Callback to update parent state
}

export function CharacterActionsSection({ character, onCharacterUpdate }: CharacterActionsSectionProps) {
    const { rollDice } = useDiceRoller();
    const { toast } = useToast();

    const handleAttackRoll = async (weapon: EquipmentItem) => {
        const profBonus = character.level >= 17 ? 6 : character.level >= 13 ? 5 : character.level >= 9 ? 4 : character.level >= 5 ? 3 : 2;
        const result = await calculateHitBonusAction(weapon, character, profBonus);

        if (result.success) {
            const hitBonus = result.bonus;
            rollDice(`1d20+${hitBonus}`, `${character.characterName} attacks with ${weapon.name}`);
        } else {
            toast({ variant: "destructive", title: "Error", description: `Failed to calculate hit bonus: ${result.error}` });
        }
    };

    const handleDamageRoll = async (weapon: EquipmentItem) => {
        const result = await calculateDamageBonusAction(weapon, character);
        if (result.success) {
            const damageBonus = result.bonus;
            const damageDice = weapon.damageDice || '1d4'; // Default to 1d4 if missing
            const rollString = damageBonus > 0 ? `${damageDice}+${damageBonus}` : (damageBonus < 0 ? `${damageDice}${damageBonus}` : damageDice); // Include sign
            rollDice(rollString, `${character.characterName}'s ${weapon.name} damage`);
        } else {
            toast({ variant: "destructive", title: "Error", description: `Failed to calculate damage bonus: ${result.error}` });
        }
    };

    const handleUseFeature = async (feature: Feature) => {
         if (!character.id || !character.playerId) return; // Need IDs for action
         if (feature.maxUses != null && (feature.currentUses ?? feature.maxUses) <= 0) {
             toast({ variant: "destructive", title: "No Uses Left", description: `No uses remaining for ${feature.name}.` });
             return;
         }

         // Check if the feature requires a choice that hasn't been made
          const choiceKey = feature.metadata?.effectType === 'choiceGrant' ? feature.metadata.choiceKey : null;
          if (choiceKey && !character.featureChoices?.[choiceKey]) {
              toast({ variant: "destructive", title: "Choice Required", description: `Please make a choice for the "${feature.name}" feature on the edit screen.` });
              return;
          }


         try {
             const result = await useFeatureAction(character.id, character.playerId, feature.name);
             if (result.success && result.character) {
                 onCharacterUpdate(result.character); // Update parent state
                 toast({ title: "Feature Used", description: `${feature.name} used.` });
                  // Optionally log to game log via server action
             } else {
                 throw new Error(result.error || 'Failed to use feature.');
             }
         } catch (error: any) {
             toast({ variant: "destructive", title: "Error", description: error.message });
         }
     };

     const handleCastSpell = async (spellName: string, spellLevel: number) => {
         if (!character.id || !character.playerId) return;
         try {
             const result = await castSpellAction(character.id, character.playerId, spellName, spellLevel);
             if (result.success && result.character) {
                 onCharacterUpdate(result.character); // Update parent state
                 toast({ title: "Spell Cast", description: `${spellName} (Level ${spellLevel}) cast.` });
                 // Optionally log to game log via server action
             } else {
                 throw new Error(result.error || 'Failed to cast spell.');
             }
         } catch (error: any) {
             toast({ variant: "destructive", title: "Error", description: error.message });
         }
     };

    const equippedWeapons = character.equipment?.filter(item => item.isEquipped && item.type === 'Weapon') || [];
    const actionableFeatures = character.features?.filter(f => f.isActionable) || [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Equipped Weapon Actions */}
                {equippedWeapons.length > 0 && (
                    <div>
                        <h4 className="font-semibold mb-2 text-sm uppercase text-muted-foreground">Attacks</h4>
                        {equippedWeapons.map((weapon, index) => {
                             const profBonus = character.level >= 17 ? 6 : character.level >= 13 ? 5 : character.level >= 9 ? 4 : character.level >= 5 ? 3 : 2;
                             const isProficient = character.proficiencies?.weapons?.includes(weapon.weaponCategory || '') || character.proficiencies?.weapons?.includes(weapon.name);
                             const strMod = Math.floor(((character.stats?.strength || 10) - 10) / 2);
                             const dexMod = Math.floor(((character.stats?.dexterity || 10) - 10) / 2);
                             let hitAbilityMod = 0;
                             let damageAbilityMod = 0;

                             if (weapon.properties?.includes('Finesse')) {
                                 hitAbilityMod = Math.max(strMod, dexMod);
                                 damageAbilityMod = Math.max(strMod, dexMod);
                             } else if (weapon.weaponCategory?.toLowerCase().includes('ranged')) {
                                 hitAbilityMod = dexMod;
                                 damageAbilityMod = dexMod;
                             } else {
                                 hitAbilityMod = strMod;
                                 damageAbilityMod = strMod;
                             }

                             let hitBonus = hitAbilityMod + (isProficient ? profBonus : 0);
                             // Quick check for Archery style bonus
                             if (character.features.some(f => f.name === 'Fighting Style: Archery') && weapon.weaponCategory?.toLowerCase().includes('ranged')) {
                                hitBonus += 2;
                             }

                             let damageBonus = damageAbilityMod;
                             // Quick check for Dueling style bonus
                             if (character.features.some(f => f.name === 'Fighting Style: Dueling') /*&& isWieldingOneHanded*/) { // Condition check needed
                                damageBonus += 2;
                             }

                             const damageDice = weapon.damageDice || '1d4';
                             const damageBonusString = damageBonus > 0 ? `+${damageBonus}` : (damageBonus < 0 ? `${damageBonus}` : '');


                             return (
                                <div key={`${weapon.name}-${index}`} className="flex items-center justify-between space-x-2 mb-2 p-2 border rounded-md">
                                    <span className="font-medium flex-1">{weapon.name}</span>
                                    <div className="flex space-x-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleAttackRoll(weapon)}
                                            className="text-xs px-2 py-1 h-auto"
                                            title={`Roll To Hit: 1d20${hitBonus >= 0 ? `+${hitBonus}` : hitBonus}`}
                                        >
                                             <Dices className="mr-1 h-3 w-3" />
                                             Hit {hitBonus >= 0 ? `+${hitBonus}` : hitBonus}
                                        </Button>
                                         <Button
                                             variant="outline"
                                             size="sm"
                                             onClick={() => handleDamageRoll(weapon)}
                                             className="text-xs px-2 py-1 h-auto"
                                             title={`Roll Damage: ${damageDice}${damageBonusString}`}
                                         >
                                              <Dices className="mr-1 h-3 w-3" />
                                              Dmg ({damageDice}{damageBonusString})
                                          </Button>
                                    </div>
                                </div>
                             );
                        })}
                        <Separator className="my-3" />
                    </div>
                )}

                {/* Actionable Features */}
                {actionableFeatures.length > 0 && (
                     <div>
                         <h4 className="font-semibold mb-2 text-sm uppercase text-muted-foreground">Features</h4>
                         {actionableFeatures.map(feature => {
                            const usesLeft = feature.maxUses != null ? (feature.currentUses ?? feature.maxUses) : null;
                            const isDisabled = feature.maxUses != null && usesLeft !== null && usesLeft <= 0;

                            // Get choice details if applicable
                            const choiceKey = feature.metadata?.effectType === 'choiceGrant' ? feature.metadata.choiceKey : null;
                            const currentChoice = choiceKey ? character.featureChoices?.[choiceKey] : null;
                            const requiresChoice = choiceKey && !currentChoice;

                            return (
                                 <TooltipProvider key={feature.name}>
                                     <Tooltip>
                                         <TooltipTrigger asChild>
                                            <div className="flex items-center justify-between space-x-2 mb-2 p-2 border rounded-md">
                                                <span className="font-medium flex-1">
                                                    {feature.name}
                                                    {requiresChoice && <Badge variant="outline" className="ml-2 text-xs text-yellow-600">Requires Choice</Badge>}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleUseFeature(feature)}
                                                    disabled={isDisabled || requiresChoice}
                                                    className="text-xs px-2 py-1 h-auto"
                                                >
                                                    Use {usesLeft !== null ? `(${usesLeft}/${feature.maxUses})` : ''}
                                                </Button>
                                            </div>
                                         </TooltipTrigger>
                                         <TooltipContent side="top" align="start">
                                              <p className="text-xs max-w-xs">{feature.description}</p>
                                              {currentChoice && <p className="text-xs italic mt-1">Selected: {Array.isArray(currentChoice) ? currentChoice.join(', ') : currentChoice}</p>}
                                          </TooltipContent>
                                     </Tooltip>
                                 </TooltipProvider>
                             );
                         })}
                     </div>
                 )}

                 {/* TODO: Add Spells Section if applicable */}

                {equippedWeapons.length === 0 && actionableFeatures.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center">No specific actions available from equipment or features.</p>
                )}
            </CardContent>
        </Card>
    );
}
