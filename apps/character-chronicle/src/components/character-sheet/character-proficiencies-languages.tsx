import React from 'react';
import type { Character } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CharacterProficienciesLanguagesProps {
    proficiencies: Character['proficiencies'];
    savingThrows: { stat: keyof Character['stats']; bonus: number; proficient: boolean }[];
    proficiencyBonus: number; // Needed for Passive Perception calculation only
    passivePerception: number; // Pass calculated passive perception
}

export function CharacterProficienciesLanguages({
    proficiencies,
    savingThrows,
    proficiencyBonus,
    passivePerception
}: CharacterProficienciesLanguagesProps) {

    const formatBonus = (bonus: number) => (bonus >= 0 ? `+${bonus}` : `${bonus}`);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Proficiencies & Languages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
                {/* Saving Throws */}
                <div>
                    <h4 className="font-semibold mb-1 text-xs uppercase text-muted-foreground">Saving Throws</h4>
                    <div className="flex flex-wrap gap-2">
                        {savingThrows.map(({ stat, bonus, proficient }) => (
                            <Badge key={stat} variant={proficient ? "default" : "secondary"} className="capitalize">
                                {stat.substring(0, 3)} {formatBonus(bonus)}
                            </Badge>
                        ))}
                    </div>
                </div>

                 {/* Passive Perception - Moved here as it uses proficiency */}
                 <div className="pt-2 border-t">
                     <h4 className="font-semibold mb-1 text-xs uppercase text-muted-foreground">Senses</h4>
                     <Badge variant="outline">Passive Perception: {passivePerception}</Badge>
                 </div>

                {/* Armor Proficiencies */}
                {proficiencies?.armor && proficiencies.armor.length > 0 && (
                    <div className="pt-2 border-t">
                        <h4 className="font-semibold mb-1 text-xs uppercase text-muted-foreground">Armor</h4>
                        <p className="text-muted-foreground">{proficiencies.armor.join(', ')}</p>
                    </div>
                )}

                {/* Weapon Proficiencies */}
                {proficiencies?.weapons && proficiencies.weapons.length > 0 && (
                    <div className="pt-2 border-t">
                        <h4 className="font-semibold mb-1 text-xs uppercase text-muted-foreground">Weapons</h4>
                        <p className="text-muted-foreground">{proficiencies.weapons.join(', ')}</p>
                    </div>
                )}

                {/* Tool Proficiencies */}
                {proficiencies?.tools && proficiencies.tools.length > 0 && (
                    <div className="pt-2 border-t">
                        <h4 className="font-semibold mb-1 text-xs uppercase text-muted-foreground">Tools</h4>
                        <p className="text-muted-foreground">{proficiencies.tools.join(', ')}</p>
                    </div>
                )}

                {/* Languages */}
                {proficiencies?.languages && proficiencies.languages.length > 0 && (
                    <div className="pt-2 border-t">
                        <h4 className="font-semibold mb-1 text-xs uppercase text-muted-foreground">Languages</h4>
                        <p className="text-muted-foreground">{proficiencies.languages.join(', ')}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
