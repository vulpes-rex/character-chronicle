import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckSquare, Square } from 'lucide-react';
import { ALL_SKILLS, SKILL_ABILITY_MAP, Character } from '@/lib/types';
import { calculateSkillModifier } from '@/services/rules-service'; // Use centralized calculation
import { useState, useEffect } from 'react'; // Import useState and useEffect

interface CharacterSkillsProps {
    character: Character;
    proficiencyBonus: number;
    onRoll: (diceString: string, label: string) => Promise<number>;
}

interface SkillDisplayData {
    name: string;
    proficient: boolean;
    modifier: number;
    ability: string;
}

export function CharacterSkills({ character, proficiencyBonus, onRoll }: CharacterSkillsProps) {
    const [skillData, setSkillData] = useState<SkillDisplayData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSkillData = async () => {
            setIsLoading(true);
            const dataPromises = ALL_SKILLS.map(async (skill) => {
                const proficient = !!character.skills[skill];
                const modifier = await calculateSkillModifier(
                    skill,
                    character.stats,
                    proficient,
                    proficiencyBonus,
                    character.features // Pass features for expertise check (if implemented)
                );
                const ability = SKILL_ABILITY_MAP[skill];
                return {
                    name: skill,
                    proficient,
                    modifier,
                    ability: ability.substring(0, 3).toUpperCase()
                };
            });
            const resolvedData = await Promise.all(dataPromises);
            setSkillData(resolvedData);
            setIsLoading(false);
        };

        if (character && character.stats) {
            fetchSkillData();
        }
    }, [character, proficiencyBonus]); // Re-run when character or proficiency bonus changes

    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Skills</CardTitle>
                <CardDescription>Proficiency Bonus: +{proficiencyBonus}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
                {isLoading ? (
                    <p>Loading skills...</p> // Add skeleton loader if preferred
                ) : (
                    skillData.map((skill) => {
                        const modifierString = skill.modifier >= 0 ? `+${skill.modifier}` : `${skill.modifier}`;
                        return (
                            <div key={skill.name} className="flex items-center justify-between p-1 rounded hover:bg-secondary/50 group">
                                <div className="flex items-center gap-2">
                                    {skill.proficient ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted" />}
                                    <Label className="capitalize text-sm font-normal flex-grow w-[100px] truncate" title={skill.name}>
                                        {skill.name}
                                        <span className='text-xs text-muted-foreground ml-1'>({skill.ability})</span>
                                    </Label>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-sm font-medium text-primary hover:bg-primary/10"
                                    onClick={() => onRoll(`1d20+${skill.modifier}`, `${skill.name.charAt(0).toUpperCase() + skill.name.slice(1)} Check`)}
                                    title={`Roll ${skill.name} check (1d20 ${modifierString})`}
                                >
                                    {modifierString}
                                </Button>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
