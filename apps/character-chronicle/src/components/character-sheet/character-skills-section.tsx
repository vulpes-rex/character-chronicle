'use client';

import React from 'react';
import type { Character } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox'; // Or just display proficiency
import { Label } from '@/components/ui/label';
import { useDiceRoller } from '@/components/dice-roll-context'; // Corrected path
import { calculateAbilityModifierAction, calculateSkillModifierAction } from '@/app/actions/rules-actions'; // Use server actions
import { SKILL_ABILITY_MAP, ALL_SKILLS } from '@/lib/types'; // Import skill mapping
import { Dices } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CharacterSkillsSectionProps {
    characterName: string;
    stats: Character['stats']; // Pass calculated stats
    skillsProficiency: Character['skills']; // Pass proficiency map
    proficiencyBonus: number;
    // features: Feature[]; // Potentially needed for expertise check
}

export function CharacterSkillsSection({
    characterName,
    stats,
    skillsProficiency,
    proficiencyBonus,
    // features, // Pass features if needed for expertise calculation
}: CharacterSkillsSectionProps) {
    const { rollDice } = useDiceRoller();
    const { toast } = useToast();

    const handleSkillRoll = async (skillName: string, modifier: number) => {
        rollDice(`1d20+${modifier}`, `${characterName} attempts a ${skillName} check`);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {ALL_SKILLS.map((skill) => {
                    const ability = SKILL_ABILITY_MAP[skill];
                    const isProficient = !!skillsProficiency?.[skill];
                    const abilityScore = stats?.[ability] ?? 10;
                    const abilityMod = Math.floor((abilityScore - 10) / 2);

                    // TODO: Implement Expertise check using features if needed
                    // const isExpert = features?.some(f => /* logic to check if f grants expertise for this skill */);
                    // const profValue = isProficient ? (isExpert ? proficiencyBonus * 2 : proficiencyBonus) : 0;
                    const profValue = isProficient ? proficiencyBonus : 0; // Simplified proficiency

                    const modifier = abilityMod + profValue;
                    const modString = modifier >= 0 ? `+${modifier}` : `${modifier}`;

                    return (
                        <div key={skill} className="flex items-center justify-between text-sm py-1 border-b border-dashed last:border-b-0">
                            <div className="flex items-center space-x-2">
                                <span className={`w-4 h-4 rounded-full border ${isProficient ? 'bg-primary border-primary' : 'border-muted'}`} title={isProficient ? 'Proficient' : 'Not Proficient'}></span>
                                <Label htmlFor={`skill-${skill}`} className="capitalize flex-1 min-w-[120px]">
                                    {skill} <span className="text-xs text-muted-foreground">({ability.substring(0, 3)})</span>
                                </Label>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSkillRoll(skill, modifier)}
                                className="px-2 py-1 h-auto font-semibold"
                                title={`Roll ${skill} Check`}
                            >
                                {modString} <Dices className="ml-1 h-3 w-3" />
                            </Button>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
