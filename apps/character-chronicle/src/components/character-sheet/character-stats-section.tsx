import React from 'react';
import type { Character } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatBox } from './stat-box'; // Assuming StatBox component handles display

interface CharacterStatsSectionProps {
    stats: Character['stats']; // Accept the final calculated stats
    proficiencyBonus: number;
}

export function CharacterStatsSection({ stats, proficiencyBonus }: CharacterStatsSectionProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Ability Scores</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
                {(Object.keys(stats) as Array<keyof typeof stats>).map((statName) => {
                    const score = stats[statName];
                    const modifier = Math.floor((score - 10) / 2);
                    // Determine proficiency from character data if needed for saving throws display
                    // const isProficient = character.proficiencies?.savingThrows?.includes(statName);
                    // const savingThrowBonus = modifier + (isProficient ? proficiencyBonus : 0);

                    return (
                        <StatBox
                            key={statName}
                            label={statName.toUpperCase()}
                            score={score}
                            modifier={modifier}
                            // savingThrow={savingThrowBonus} // Optional: Pass saving throw if StatBox displays it
                        />
                    );
                })}
            </CardContent>
        </Card>
    );
}
